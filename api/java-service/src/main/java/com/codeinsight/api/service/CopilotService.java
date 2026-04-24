package com.codeinsight.api.service;

import com.codeinsight.api.dto.*;
import com.codeinsight.api.entity.CopilotMessageEntity;
import com.codeinsight.api.entity.CopilotSessionEntity;
import com.codeinsight.api.entity.ProjectMemoryEntity;
import com.codeinsight.api.mongo.CopilotEvidenceDoc;
import com.codeinsight.api.mongo.CopilotEvidenceRepository;
import com.codeinsight.api.repo.CopilotMessageRepository;
import com.codeinsight.api.repo.CopilotSessionRepository;
import com.codeinsight.api.repo.ProjectMemoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CopilotService {

    private final CopilotSessionRepository sessionRepository;
    private final CopilotMessageRepository messageRepository;
    private final ProjectMemoryRepository projectMemoryRepository;
    private final ProjectAppService projectAppService;
    private final DeepseekClient deepseekClient;
    private final AssistPlanService assistPlanService;
    private final CodeRetrievalService codeRetrievalService;
    private final JsonCodec jsonCodec;

    // Mongo/Redis 为可选组件：没配时也不影响主流程（只是不落对应存储）
    private final CopilotEvidenceRepository evidenceRepository;
    private final StringRedisTemplate redisTemplate;

    public CopilotService(
            CopilotSessionRepository sessionRepository,
            CopilotMessageRepository messageRepository,
            ProjectMemoryRepository projectMemoryRepository,
            ProjectAppService projectAppService,
            DeepseekClient deepseekClient,
            AssistPlanService assistPlanService,
            CodeRetrievalService codeRetrievalService,
            JsonCodec jsonCodec,
            CopilotEvidenceRepository evidenceRepository,
            StringRedisTemplate redisTemplate
    ) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.projectMemoryRepository = projectMemoryRepository;
        this.projectAppService = projectAppService;
        this.deepseekClient = deepseekClient;
        this.assistPlanService = assistPlanService;
        this.codeRetrievalService = codeRetrievalService;
        this.jsonCodec = jsonCodec;
        this.evidenceRepository = evidenceRepository;
        this.redisTemplate = redisTemplate;
    }

    public List<CopilotSessionDto> listSessions(String projectId) {
        if (projectId == null || projectId.trim().isEmpty()) return new ArrayList<CopilotSessionDto>();
        return sessionRepository.findByProjectIdOrderByUpdatedAtDesc(projectId.trim())
                .stream()
                .map(s -> new CopilotSessionDto(s.getId(), s.getProjectId(), s.getTitle(), s.getLastMode(), s.getUpdatedAt()))
                .collect(Collectors.toList());
    }

    public List<CopilotMessageDto> listMessages(String sessionId, int limit) {
        String sid = sessionId == null ? null : sessionId.trim();
        if (sid == null || sid.isEmpty()) throw new IllegalArgumentException("session_id is required");
        int n = Math.max(1, Math.min(limit, 200));

        List<CopilotMessageEntity> rows = messageRepository.findBySessionIdOrderByCreatedAtDesc(sid, PageRequest.of(0, n));
        Collections.reverse(rows);

        List<CopilotMessageDto> out = new ArrayList<CopilotMessageDto>();
        for (CopilotMessageEntity e : rows) {
            List<CodeCitation> citations = null;
            try {
                if (e.getCitationsJson() != null && !e.getCitationsJson().trim().isEmpty()) {
                    citations = jsonCodec.fromJson(e.getCitationsJson(), new TypeReference<List<CodeCitation>>() {});
                }
            } catch (Exception ignored) {
            }
            out.add(new CopilotMessageDto(
                    e.getId(),
                    e.getSessionId(),
                    e.getProjectId(),
                    e.getMode(),
                    e.getRole(),
                    e.getContent(),
                    e.getReasoning(),
                    citations,
                    e.getCreatedAt()
            ));
        }
        return out;
    }

    @Transactional
    public CopilotMessageResponse send(CopilotMessageRequest req) {
        String projectId = req == null ? null : req.getProject_id();
        String message = req == null ? null : req.getMessage();
        String mode = normalizeMode(req == null ? null : req.getMode());
        boolean thinking = req != null && req.getThinking() != null && req.getThinking();
        int topK = req != null && req.getTop_k() != null ? Math.max(1, Math.min(req.getTop_k(), 20)) : 8;

        if (projectId == null || projectId.trim().isEmpty()) throw new IllegalArgumentException("project_id is required");
        if (message == null || message.trim().isEmpty()) throw new IllegalArgumentException("message is required");

        CopilotSessionEntity session = getOrCreateSession(projectId.trim(), req.getSession_id(), message.trim());
        session.setLastMode(mode);
        sessionRepository.save(session);

        // 1) 先落 user 消息到 MySQL
        saveMessage(session.getId(), projectId.trim(), mode, "user", message.trim(), null, null);

        CopilotMessageResponse out = new CopilotMessageResponse();
        out.setSession_id(session.getId());
        out.setMode(mode);

        if ("plan".equals(mode)) {
            AssistPlanRequest planReq = new AssistPlanRequest();
            planReq.setProject_id(projectId.trim());
            planReq.setRequirement(message.trim());
            planReq.setConstraints(req.getConstraints());
            planReq.setThinking(thinking);
            AssistPlanResponse plan = assistPlanService.generatePlan(planReq);
            out.setAnswer(plan.getPlan_text());
            out.setPlan_json(plan.getPlan_json());
            out.setPlan_text(plan.getPlan_text());
            out.setReasoning(plan.getReasoning());
            out.setCitations(plan.getCitations());
            out.setEvidence(plan.getEvidence());
        } else if ("code".equals(mode)) {
            CodeRetrievalResult retrieval = codeRetrievalService.retrieve(projectId.trim(), message.trim(), topK);
            DeepseekChatResult r = askWithHistoryAndEvidence(projectId.trim(), session.getId(), mode, message.trim(), retrieval.getEvidence(), thinking);
            out.setAnswer(r.getContent());
            out.setReasoning(thinking ? r.getReasoningContent() : null);
            out.setCitations(retrieval.getCitations());
            out.setEvidence(retrieval.getEvidence());
        } else {
            // chat 模式：带项目记忆 + 会话历史，偏“概况/讨论”对话
            DeepseekChatResult r = askWithHistoryAndEvidence(projectId.trim(), session.getId(), mode, message.trim(), null, thinking);
            out.setAnswer(r.getContent());
            out.setReasoning(thinking ? r.getReasoningContent() : null);
        }

        // 2) 落 assistant 消息到 MySQL
        CopilotMessageEntity assistant = saveMessage(
                session.getId(),
                projectId.trim(),
                mode,
                "assistant",
                out.getAnswer() == null ? "" : out.getAnswer(),
                out.getReasoning(),
                out.getCitations()
        );

        // 3) 重证据内容写 Mongo（可选）
        persistEvidenceToMongo(assistant.getId(), session.getId(), projectId.trim(), mode, out.getEvidence(), out.getCitations());

        // 4) 会话缓存到 Redis（可选）
        cacheRecentMessages(session.getId());

        // 5) 更新项目长期记忆（简化策略：用最近一条 assistant 内容作为增量摘要）
        updateProjectMemory(projectId.trim(), out.getAnswer());

        return out;
    }

    public void stream(CopilotMessageRequest req, CopilotStreamListener listener) {
        try {
            String projectId = req == null ? null : req.getProject_id();
            String message = req == null ? null : req.getMessage();
            String mode = normalizeMode(req == null ? null : req.getMode());
            boolean thinking = req != null && req.getThinking() != null && req.getThinking();
            int topK = req != null && req.getTop_k() != null ? Math.max(1, Math.min(req.getTop_k(), 20)) : 8;

            if (projectId == null || projectId.trim().isEmpty()) throw new IllegalArgumentException("project_id is required");
            if (message == null || message.trim().isEmpty()) throw new IllegalArgumentException("message is required");

            CopilotSessionEntity session = startSession(projectId.trim(), req.getSession_id(), message.trim(), mode);
            String sid = session.getId();
            String pid = projectId.trim();
            String userMsg = message.trim();

            CopilotMessageResponse meta = new CopilotMessageResponse();
            meta.setSession_id(sid);
            meta.setMode(mode);

            CopilotMessageResponse out = new CopilotMessageResponse();
            out.setSession_id(sid);
            out.setMode(mode);

            if ("plan".equals(mode)) {
                AssistPlanRequest planReq = new AssistPlanRequest();
                planReq.setProject_id(pid);
                planReq.setRequirement(userMsg);
                planReq.setConstraints(req.getConstraints());
                planReq.setThinking(thinking);
                AssistPlanResponse plan = assistPlanService.generatePlan(planReq);
                out.setAnswer(plan.getPlan_text());
                out.setPlan_json(plan.getPlan_json());
                out.setPlan_text(plan.getPlan_text());
                out.setReasoning(plan.getReasoning());
                out.setCitations(plan.getCitations());
                out.setEvidence(plan.getEvidence());

                if (listener != null) listener.onMeta(out);
                finalizeAssistant(sid, pid, mode, out.getAnswer(), out.getReasoning(), out.getCitations(), out.getEvidence());
                if (listener != null) listener.onDone(out);
                return;
            }

            if ("code".equals(mode)) {
                CodeRetrievalResult retrieval = codeRetrievalService.retrieve(pid, userMsg, topK);
                meta.setCitations(retrieval.getCitations());
                meta.setEvidence(retrieval.getEvidence());
                if (listener != null) listener.onMeta(meta);

                final String evidence = retrieval.getEvidence();
                final StringBuilder contentSb = new StringBuilder();
                final StringBuilder reasoningSb = new StringBuilder();

                DeepseekChatResult r = deepseekClient.streamChatWithReasoning(
                        buildMessages(pid, sid, mode, userMsg, evidence),
                        thinking,
                        (c, rr) -> {
                            if (c != null && !c.isEmpty()) contentSb.append(c);
                            if (rr != null && !rr.isEmpty()) reasoningSb.append(rr);
                            if (listener != null) listener.onDelta(c, rr);
                        }
                );

                out.setAnswer(r.getContent());
                out.setReasoning(thinking ? r.getReasoningContent() : null);
                out.setCitations(retrieval.getCitations());
                out.setEvidence(retrieval.getEvidence());

                finalizeAssistant(sid, pid, mode, out.getAnswer(), out.getReasoning(), out.getCitations(), out.getEvidence());
                if (listener != null) listener.onDone(out);
                return;
            }

            if (listener != null) listener.onMeta(meta);
            DeepseekChatResult r = deepseekClient.streamChatWithReasoning(
                    buildMessages(pid, sid, mode, userMsg, null),
                    thinking,
                    (c, rr) -> {
                        if (listener != null) listener.onDelta(c, rr);
                    }
            );
            out.setAnswer(r.getContent());
            out.setReasoning(thinking ? r.getReasoningContent() : null);

            finalizeAssistant(sid, pid, mode, out.getAnswer(), out.getReasoning(), null, null);
            if (listener != null) listener.onDone(out);
        } catch (Exception e) {
            if (listener != null) listener.onError(e.getMessage() == null ? "stream failed" : e.getMessage());
        }
    }

    private DeepseekChatResult askWithHistoryAndEvidence(
            String projectId,
            String sessionId,
            String mode,
            String userQuestion,
            String evidence,
            boolean thinking
    ) {
        return deepseekClient.chatWithReasoning(buildMessages(projectId, sessionId, mode, userQuestion, evidence), thinking);
    }

    private List<Map<String, String>> buildMessages(String projectId, String sessionId, String mode, String userQuestion, String evidence) {
        List<Map<String, String>> messages = new ArrayList<Map<String, String>>();

        String projectMemory = projectMemoryRepository.findByProjectId(projectId).map(ProjectMemoryEntity::getSummary).orElse("");
        String graphSummary = summarizeGraph(projectId);

        String system = "你是 CodeInsight Copilot。请基于会话历史、项目记忆和证据回答。避免编造。";
        if ("code".equals(mode)) {
            system += " 你正在“与代码对话”模式，回答时请给出依据并引用证据编号（如 [1][2]）。";
        } else if ("plan".equals(mode)) {
            system += " 你正在“计划模式”，请输出可执行的改动方案与验证步骤。";
        } else {
            system += " 你正在“聊天模式”，回答应简洁清晰。";
        }
        messages.add(msg("system", system));

        if (projectMemory != null && !projectMemory.trim().isEmpty()) {
            messages.add(msg("system", "项目长期记忆摘要：\n" + projectMemory.trim()));
        }
        if (graphSummary != null && !graphSummary.trim().isEmpty()) {
            messages.add(msg("system", "项目依赖图摘要：\n" + graphSummary));
        }
        if (evidence != null && !evidence.trim().isEmpty()) {
            messages.add(msg("system", "检索证据：\n" + evidence.trim()));
        }

        List<CopilotMessageEntity> history = messageRepository.findTop40BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(history);
        for (CopilotMessageEntity h : history) {
            if (!"user".equals(h.getRole()) && !"assistant".equals(h.getRole())) continue;
            String content = h.getContent() == null ? "" : h.getContent();
            if (content.trim().isEmpty()) continue;
            messages.add(msg(h.getRole(), content));
        }

        messages.add(msg("user", userQuestion));
        return messages;
    }

    @Transactional
    private CopilotSessionEntity startSession(String projectId, String sessionId, String firstMsg, String mode) {
        CopilotSessionEntity session = getOrCreateSession(projectId, sessionId, firstMsg);
        session.setLastMode(mode);
        sessionRepository.save(session);
        saveMessage(session.getId(), projectId, mode, "user", firstMsg, null, null);
        return session;
    }

    @Transactional
    private void finalizeAssistant(
            String sessionId,
            String projectId,
            String mode,
            String answer,
            String reasoning,
            List<CodeCitation> citations,
            String evidence
    ) {
        CopilotMessageEntity assistant = saveMessage(
                sessionId,
                projectId,
                mode,
                "assistant",
                answer == null ? "" : answer,
                reasoning,
                citations
        );
        persistEvidenceToMongo(assistant.getId(), sessionId, projectId, mode, evidence, citations);
        cacheRecentMessages(sessionId);
        updateProjectMemory(projectId, answer);
    }

    private CopilotSessionEntity getOrCreateSession(String projectId, String sessionId, String firstMsg) {
        CopilotSessionEntity s = null;
        if (sessionId != null && !sessionId.trim().isEmpty()) {
            s = sessionRepository.findById(sessionId.trim()).orElse(null);
        }
        if (s != null) return s;

        CopilotSessionEntity created = new CopilotSessionEntity();
        created.setProjectId(projectId);
        created.setTitle(firstMsg.length() > 30 ? firstMsg.substring(0, 30) + "..." : firstMsg);
        created.setLastMode("code");
        return sessionRepository.save(created);
    }

    private CopilotMessageEntity saveMessage(
            String sessionId,
            String projectId,
            String mode,
            String role,
            String content,
            String reasoning,
            List<CodeCitation> citations
    ) {
        CopilotMessageEntity e = new CopilotMessageEntity();
        e.setSessionId(sessionId);
        e.setProjectId(projectId);
        e.setMode(mode);
        e.setRole(role);
        e.setContent(content == null ? "" : content);
        e.setReasoning(reasoning);
        e.setCitationsJson(citations == null ? null : jsonCodec.toJson(citations));
        return messageRepository.save(e);
    }

    private void persistEvidenceToMongo(String messageId, String sessionId, String projectId, String mode, String evidence, List<CodeCitation> citations) {
        try {
            if (evidenceRepository == null) return;
            if (evidence == null || evidence.trim().isEmpty()) return;
            CopilotEvidenceDoc d = new CopilotEvidenceDoc();
            d.setMessageId(messageId);
            d.setSessionId(sessionId);
            d.setProjectId(projectId);
            d.setMode(mode);
            d.setEvidence(evidence);
            d.setCitationsJson(citations == null ? null : jsonCodec.toJson(citations));
            d.setCreatedAt(Instant.now());
            evidenceRepository.save(d);
        } catch (Exception ignored) {
        }
    }

    private void cacheRecentMessages(String sessionId) {
        try {
            if (redisTemplate == null) return;
            List<CopilotMessageEntity> recent = messageRepository.findTop40BySessionIdOrderByCreatedAtDesc(sessionId);
            String key = "copilot:session:" + sessionId + ":recent";
            redisTemplate.opsForValue().set(key, jsonCodec.toJson(recent), Duration.ofHours(6));
        } catch (Exception ignored) {
        }
    }

    private void updateProjectMemory(String projectId, String latestAnswer) {
        if (latestAnswer == null || latestAnswer.trim().isEmpty()) return;
        try {
            ProjectMemoryEntity pm = projectMemoryRepository.findByProjectId(projectId).orElse(null);
            if (pm == null) {
                pm = new ProjectMemoryEntity();
                pm.setProjectId(projectId);
                pm.setSummary(shorten(latestAnswer, 1200));
            } else {
                String merged = (pm.getSummary() == null ? "" : pm.getSummary()) + "\n- " + shorten(latestAnswer, 300);
                pm.setSummary(shorten(merged, 2000));
            }
            projectMemoryRepository.save(pm);
        } catch (Exception ignored) {
        }
    }

    private String summarizeGraph(String projectId) {
        GraphData g = projectAppService.getDependencies(projectId);
        if (g == null) return "";
        int nodes = g.getNodes() == null ? 0 : g.getNodes().size();
        int links = g.getLinks() == null ? 0 : g.getLinks().size();
        return "- nodes: " + nodes + "\n- links: " + links;
    }

    private static String normalizeMode(String mode) {
        String m = mode == null ? "chat" : mode.trim().toLowerCase();
        if ("plan".equals(m) || "code".equals(m) || "chat".equals(m)) return m;
        return "chat";
    }

    private static String shorten(String s, int limit) {
        if (s == null) return "";
        String t = s.trim();
        if (t.length() <= limit) return t;
        return t.substring(0, limit) + "...";
    }

    private static Map<String, String> msg(String role, String content) {
        Map<String, String> m = new LinkedHashMap<String, String>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
