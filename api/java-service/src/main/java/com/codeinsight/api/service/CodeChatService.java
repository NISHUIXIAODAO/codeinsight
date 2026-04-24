package com.codeinsight.api.service;

import com.codeinsight.api.dto.CodeChatRequest;
import com.codeinsight.api.dto.CodeChatResponse;
import com.codeinsight.api.dto.CodeCitation;
import com.codeinsight.api.entity.CodeChunkEntity;
import com.codeinsight.api.repo.CodeChunkRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CodeChatService {

    private final PineconeClient pineconeClient;
    private final CodeChunkRepository codeChunkRepository;
    private final DeepseekClient deepseekClient;

    public CodeChatService(PineconeClient pineconeClient, CodeChunkRepository codeChunkRepository, DeepseekClient deepseekClient) {
        this.pineconeClient = pineconeClient;
        this.codeChunkRepository = codeChunkRepository;
        this.deepseekClient = deepseekClient;
    }

    /**
     * “与代码对话”（RAG）：
     * 1) 用 Pinecone Inference API 把问题转成向量
     * 2) Pinecone Index TopK 检索 chunk id
     * 3) 从本地数据库取回 chunk 内容，拼成证据上下文
     * 4) 让模型基于证据回答，并要求引用文件与行号
     */
    public CodeChatResponse chat(CodeChatRequest req) {
        String projectId = req == null ? null : req.getProject_id();
        String question = req == null ? null : req.getQuestion();
        if (projectId == null || projectId.trim().isEmpty()) {
            throw new IllegalArgumentException("project_id is required");
        }
        if (question == null || question.trim().isEmpty()) {
            throw new IllegalArgumentException("question is required");
        }

        boolean thinking = req.getThinking() != null && req.getThinking();
        int topK = req.getTop_k() == null ? 8 : Math.max(1, Math.min(req.getTop_k(), 20));

        float[] q = pineconeClient.embedQuery(question.trim());
        if (q == null) throw new RuntimeException("Failed to embed query");

        List<PineconeMatch> matches = pineconeClient.query(projectId.trim(), q, topK);
        if (matches.isEmpty()) {
            String answer = "当前项目还没有可检索的代码索引。请先对该项目执行一次索引（index），再进行代码问答。";
            return new CodeChatResponse(answer, null, new ArrayList<CodeCitation>());
        }

        List<String> ids = matches.stream().map(PineconeMatch::getId).collect(Collectors.toList());
        List<CodeChunkEntity> chunks = codeChunkRepository.findByProjectIdAndIdIn(projectId.trim(), ids);

        Map<String, CodeChunkEntity> chunkById = new HashMap<String, CodeChunkEntity>();
        for (CodeChunkEntity c : chunks) chunkById.put(c.getId(), c);

        List<CodeCitation> citations = new ArrayList<CodeCitation>();
        StringBuilder evidence = new StringBuilder();

        int idx = 1;
        for (PineconeMatch m : matches) {
            CodeChunkEntity c = chunkById.get(m.getId());
            if (c == null) continue;
            citations.add(new CodeCitation(c.getId(), c.getFilePath(), c.getStartLine(), c.getEndLine(), m.getScore()));

            evidence.append("[").append(idx).append("] ")
                    .append(c.getFilePath()).append(":")
                    .append(c.getStartLine()).append("-").append(c.getEndLine())
                    .append("\n")
                    .append(c.getContent())
                    .append("\n\n");
            idx++;
            if (idx > 10) break;
        }

        // 为了让回答“可溯源”，要求模型在结尾列出引用编号
        String system = ""
                + "你是一个智能代码理解助手。你必须严格基于提供的【证据片段】回答问题，避免编造。\n"
                + "如果证据不足，请明确说明缺少哪些文件/函数，并给出下一步索引/检索建议。\n"
                + "回答格式要求：\n"
                + "1) 先给结论\n"
                + "2) 再给依据（引用证据编号，例如 [1][3]）\n";

        String user = ""
                + "问题：\n" + question.trim() + "\n\n"
                + "【证据片段】\n" + evidence;

        List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
        messages.add(msg("system", system));
        messages.add(msg("user", user));

        DeepseekChatResult r = deepseekClient.chatWithReasoning(messages, thinking);
        String reasoning = thinking ? r.getReasoningContent() : null;

        return new CodeChatResponse(r.getContent(), reasoning, citations);
    }

    private static Map<String, String> msg(String role, String content) {
        Map<String, String> m = new LinkedHashMap<String, String>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
