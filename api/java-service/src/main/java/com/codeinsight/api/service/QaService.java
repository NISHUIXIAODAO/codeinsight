package com.codeinsight.api.service;

import com.codeinsight.api.dto.GraphData;
import com.codeinsight.api.dto.GraphLink;
import com.codeinsight.api.dto.GraphNode;
import com.codeinsight.api.dto.QaRequest;
import com.codeinsight.api.dto.QaResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QaService {

    private final DeepseekClient deepseekClient;
    private final ProjectAppService projectAppService;

    public QaService(DeepseekClient deepseekClient, ProjectAppService projectAppService) {
        this.deepseekClient = deepseekClient;
        this.projectAppService = projectAppService;
    }

    /**
     * 这里把“项目依赖图摘要”注入到 LLM 的上下文中，避免纯聊天无法落地到真实仓库。
     * 如果你后续想更强：可以进一步把“核心链路/Top N 依赖/分层信息”等做成结构化 JSON 再喂给模型。
     */
    public QaResponse ask(QaRequest req) {
        String question = req == null ? null : req.getQuestion();
        if (question == null || question.trim().isEmpty()) {
            throw new IllegalArgumentException("question is required");
        }

        String projectId = req.getProject_id();
        String userContext = req.getContext();

        String graphSummary = "";
        if (projectId != null && !projectId.trim().isEmpty()) {
            GraphData g = projectAppService.getDependencies(projectId.trim());
            graphSummary = summarizeGraph(g);
        }

        String system = "你是一个智能代码理解助手。你需要基于用户给出的上下文与项目图谱摘要回答问题。"
                + "如果上下文不足，请明确说明缺少哪些信息，并给出可执行的下一步。"
                + "回答尽量简洁、结构化。";

        StringBuilder user = new StringBuilder();
        user.append("项目ID：").append(projectId).append("\n");
        if (graphSummary != null && !graphSummary.trim().isEmpty()) {
            user.append("项目依赖图谱摘要：\n").append(graphSummary).append("\n");
        }
        if (userContext != null && !userContext.trim().isEmpty()) {
            user.append("补充上下文：\n").append(userContext.trim()).append("\n");
        }
        user.append("问题：").append(question.trim()).append("\n");

        List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
        messages.add(msg("system", system));
        messages.add(msg("user", user.toString()));

        boolean thinking = req.getThinking() != null && req.getThinking();
        DeepseekChatResult r = deepseekClient.chatWithReasoning(messages, thinking);

        String reasoning = r.getReasoningContent();
        if (!thinking) reasoning = null;

        return new QaResponse(r.getContent(), reasoning, null);
    }

    private static Map<String, String> msg(String role, String content) {
        Map<String, String> m = new HashMap<String, String>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

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

        for (GraphNode n : nodes) {
            if (n == null) continue;
            String type = n.getType();
            if (type != null) byType.put(type, (byType.get(type) == null ? 0 : byType.get(type)) + 1);
            String role = n.getRole();
            if (role != null && !role.trim().isEmpty()) byRole.put(role, (byRole.get(role) == null ? 0 : byRole.get(role)) + 1);
        }

        Map<String, Integer> byEdgeType = new HashMap<String, Integer>();
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
}
