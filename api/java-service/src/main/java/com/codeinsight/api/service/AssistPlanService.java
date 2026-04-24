package com.codeinsight.api.service;

import com.codeinsight.api.dto.AssistPlanRequest;
import com.codeinsight.api.dto.AssistPlanResponse;
import com.codeinsight.api.dto.CodeCitation;
import com.codeinsight.api.dto.GraphData;
import com.codeinsight.api.dto.GraphLink;
import com.codeinsight.api.dto.GraphNode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AssistPlanService {

    private final DeepseekClient deepseekClient;
    private final ProjectAppService projectAppService;
    private final CodeRetrievalService codeRetrievalService;
    private final ObjectMapper objectMapper;

    public AssistPlanService(
            DeepseekClient deepseekClient,
            ProjectAppService projectAppService,
            CodeRetrievalService codeRetrievalService,
            ObjectMapper objectMapper
    ) {
        this.deepseekClient = deepseekClient;
        this.projectAppService = projectAppService;
        this.codeRetrievalService = codeRetrievalService;
        this.objectMapper = objectMapper;
    }

    /**
     * “一键生成改动计划”：
     * - 输入：需求 +（可选）项目ID
     * - 输出：结构化 JSON 计划 + 可读文本版 +（可选）推理过程
     */
    public AssistPlanResponse generatePlan(AssistPlanRequest req) {
        String requirement = req == null ? null : req.getRequirement();
        if (requirement == null || requirement.trim().isEmpty()) {
            throw new IllegalArgumentException("requirement is required");
        }

        boolean thinking = req.getThinking() != null && req.getThinking();
        String projectId = req.getProject_id();
        String constraints = req.getConstraints();

        String graphSummary = "";
        if (projectId != null && !projectId.trim().isEmpty()) {
            GraphData g = projectAppService.getDependencies(projectId.trim());
            graphSummary = summarizeGraph(g);
        }

        // 如果项目已完成 index，则这里会从 Pinecone TopK 检索出相关代码片段作为“证据”注入到模型上下文中。
        // 这样生成的计划就不仅依赖图谱（宏观），还能引用具体文件/行号（微观）。
        List<CodeCitation> citations = new ArrayList<CodeCitation>();
        String evidence = "";
        if (projectId != null && !projectId.trim().isEmpty()) {
            try {
                CodeRetrievalResult r = codeRetrievalService.retrieve(projectId.trim(), requirement.trim(), 8);
                if (r != null) {
                    citations = r.getCitations() == null ? new ArrayList<CodeCitation>() : r.getCitations();
                    evidence = r.getEvidence() == null ? "" : r.getEvidence();
                }
            } catch (Exception ignored) {
                citations = new ArrayList<CodeCitation>();
                evidence = "";
            }
        }

        String system = ""
                + "你是一个资深的软件工程师与架构师，负责为一个已有代码仓库生成“可执行的改动计划”。\n"
                + "你必须输出严格的 JSON（不要输出 markdown、不要输出解释文字、不要用代码块包裹）。\n"
                + "JSON schema（必须包含这些字段）：\n"
                + "{\n"
                + "  \"title\": string,\n"
                + "  \"assumptions\": string[],\n"
                + "  \"files_to_change\": {\"path\": string, \"change_type\": \"modify\"|\"add\", \"reason\": string, \"evidence_refs\": number[]}[],\n"
                + "  \"api_changes\": {\"method\": string, \"path\": string, \"summary\": string}[],\n"
                + "  \"steps\": {\"id\": string, \"description\": string, \"details\": string, \"validation\": string[]}[],\n"
                + "  \"risks\": string[],\n"
                + "  \"verification\": string[]\n"
                + "}\n"
                + "注意：文件路径请使用相对项目根目录的路径，例如：src/pages/Projects/QA.tsx。\n"
                + "如果提供了【证据片段】，请在 steps.details 中尽量引用证据编号（例如 [1][3]），并在 files_to_change 中只列出你有证据支持的文件。\n"
                + "files_to_change[].evidence_refs 必须来自证据编号，不能留空。\n";

        StringBuilder user = new StringBuilder();
        user.append("需求：\n").append(requirement.trim()).append("\n\n");
        if (constraints != null && !constraints.trim().isEmpty()) {
            user.append("约束：\n").append(constraints.trim()).append("\n\n");
        }
        if (projectId != null && !projectId.trim().isEmpty()) {
            user.append("项目ID：").append(projectId.trim()).append("\n");
        }
        if (graphSummary != null && !graphSummary.trim().isEmpty()) {
            user.append("项目依赖图谱摘要：\n").append(graphSummary).append("\n");
        } else {
            user.append("项目依赖图谱摘要：\n(无/未解析)\n");
        }

        if (evidence != null && !evidence.trim().isEmpty()) {
            user.append("\n【证据片段（来自向量检索）】\n");
            user.append(evidence.trim()).append("\n");
        } else {
            user.append("\n【证据片段（来自向量检索）】\n(无/未索引/检索不到)\n");
        }

        user.append("\n已知后端 API（供你对齐）：\n");
        user.append("- GET /api/projects\n");
        user.append("- POST /api/projects/import\n");
        user.append("- POST /api/projects/{id}/parse\n");
        user.append("- GET /api/projects/{id}/dependencies\n");
        user.append("- GET /api/tasks\n");
        user.append("- GET /api/tasks/{id}\n");
        user.append("- POST /api/qa\n");
        user.append("- POST /api/assist/plan（你正在为它生成计划）\n");

        List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
        messages.add(msg("system", system));
        messages.add(msg("user", user.toString()));

        DeepseekChatResult r = deepseekClient.chatWithReasoning(messages, thinking);
        String rawJson = r.getContent();

        String normalizedJson = tryNormalizeJson(rawJson);
        String planText = normalizedJson != null ? toPrettyText(normalizedJson) : rawJson;

        String reasoning = r.getReasoningContent();
        if (!thinking) reasoning = null;

        return new AssistPlanResponse(normalizedJson, planText, reasoning, citations, evidence);
    }

    private static Map<String, String> msg(String role, String content) {
        Map<String, String> m = new HashMap<String, String>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

    /**
     * 把依赖图谱压缩成 LLM 可消费的摘要（小而有用）。
     * 后续你可以继续升级：比如抽取 controller->service->repo 主链路、Top N 高频依赖等。
     */
    private static String summarizeGraph(GraphData g) {
        if (g == null) return "";
        List<GraphNode> nodes = g.getNodes();
        List<GraphLink> links = g.getLinks();
        if (nodes == null) nodes = new ArrayList<GraphNode>();
        if (links == null) links = new ArrayList<GraphLink>();

        int nodeCount = nodes.size();
        int linkCount = links.size();

        Map<String, Integer> byType = new HashMap<String, Integer>();
        Map<String, Integer> byRole = new HashMap<String, Integer>();
        Map<String, Integer> byEdgeType = new HashMap<String, Integer>();

        for (GraphNode n : nodes) {
            if (n == null) continue;
            String type = n.getType();
            if (type != null) byType.put(type, (byType.get(type) == null ? 0 : byType.get(type)) + 1);
            String role = n.getRole();
            if (role != null && !role.trim().isEmpty()) byRole.put(role, (byRole.get(role) == null ? 0 : byRole.get(role)) + 1);
        }
        for (GraphLink l : links) {
            if (l == null) continue;
            String t = l.getType();
            if (t != null) byEdgeType.put(t, (byEdgeType.get(t) == null ? 0 : byEdgeType.get(t)) + 1);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("- nodes: ").append(nodeCount).append("\n");
        sb.append("- links: ").append(linkCount).append("\n");
        sb.append("- node_types: ").append(byType).append("\n");
        if (!byRole.isEmpty()) sb.append("- java_roles: ").append(byRole).append("\n");
        if (!byEdgeType.isEmpty()) sb.append("- edge_types: ").append(byEdgeType).append("\n");
        return sb.toString();
    }

    /**
     * 尝试把模型输出“纠正”为合法 JSON 字符串：
     * - 去掉多余前后缀
     * - 只截取第一段 {...}
     */
    private String tryNormalizeJson(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;

        int first = s.indexOf('{');
        int last = s.lastIndexOf('}');
        if (first >= 0 && last > first) {
            s = s.substring(first, last + 1).trim();
        }

        try {
            JsonNode n = objectMapper.readTree(s);
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 把 JSON 变成可读文本（用于前端直接展示）。
     */
    private String toPrettyText(String json) {
        try {
            JsonNode n = objectMapper.readTree(json);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(n);
        } catch (Exception e) {
            return json;
        }
    }
}
