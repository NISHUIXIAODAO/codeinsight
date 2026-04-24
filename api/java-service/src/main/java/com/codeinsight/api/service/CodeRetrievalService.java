package com.codeinsight.api.service;

import com.codeinsight.api.dto.CodeCitation;
import com.codeinsight.api.entity.CodeChunkEntity;
import com.codeinsight.api.mongo.CodeChunkDoc;
import com.codeinsight.api.mongo.CodeChunkDocRepository;
import com.codeinsight.api.repo.CodeChunkRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CodeRetrievalService {

    private final PineconeClient pineconeClient;
    private final CodeChunkRepository codeChunkRepository;
    private final CodeChunkDocRepository codeChunkDocRepository;

    public CodeRetrievalService(
            PineconeClient pineconeClient,
            CodeChunkRepository codeChunkRepository,
            CodeChunkDocRepository codeChunkDocRepository
    ) {
        this.pineconeClient = pineconeClient;
        this.codeChunkRepository = codeChunkRepository;
        this.codeChunkDocRepository = codeChunkDocRepository;
    }

    /**
     * 代码检索（向量检索 topK）：
     * - 输入：projectId + query
     * - 输出：citations（文件/行号/得分）+ evidence（拼接后的代码片段文本）
     */
    public CodeRetrievalResult retrieve(String projectId, String query, int topK) {
        String pid = projectId == null ? null : projectId.trim();
        String q = query == null ? null : query.trim();
        if (pid == null || pid.isEmpty()) throw new IllegalArgumentException("projectId is required");
        if (q == null || q.isEmpty()) throw new IllegalArgumentException("query is required");

        int k = Math.max(1, Math.min(topK, 20));

        float[] vector = pineconeClient.embedQuery(q);
        if (vector == null) return new CodeRetrievalResult(new ArrayList<CodeCitation>(), "");

        List<PineconeMatch> matches = pineconeClient.query(pid, vector, k);
        if (matches == null || matches.isEmpty()) {
            return new CodeRetrievalResult(new ArrayList<CodeCitation>(), "");
        }

        List<String> ids = matches.stream().map(PineconeMatch::getId).collect(Collectors.toList());
        List<CodeChunkEntity> chunks = codeChunkRepository.findByProjectIdAndIdIn(pid, ids);
        List<CodeChunkDoc> docs = codeChunkDocRepository.findByProjectIdAndIdIn(pid, ids);

        Map<String, CodeChunkEntity> chunkById = new HashMap<String, CodeChunkEntity>();
        for (CodeChunkEntity c : chunks) chunkById.put(c.getId(), c);

        Map<String, CodeChunkDoc> docById = new HashMap<String, CodeChunkDoc>();
        for (CodeChunkDoc d : docs) docById.put(d.getId(), d);

        List<CodeCitation> citations = new ArrayList<CodeCitation>();
        StringBuilder evidence = new StringBuilder();

        int i = 1;
        for (PineconeMatch m : matches) {
            CodeChunkEntity c = chunkById.get(m.getId());
            if (c == null) continue;

            citations.add(new CodeCitation(c.getId(), c.getFilePath(), c.getStartLine(), c.getEndLine(), m.getScore()));

            CodeChunkDoc d = docById.get(c.getId());
            String content = d != null ? d.getContent() : c.getContent();

            evidence.append("[")
                    .append(i)
                    .append("] ")
                    .append(c.getFilePath())
                    .append(":")
                    .append(c.getStartLine())
                    .append("-")
                    .append(c.getEndLine())
                    .append("\n")
                    .append(content == null ? "" : content)
                    .append("\n\n");

            i++;
            if (i > 12) break;
        }

        return new CodeRetrievalResult(citations, evidence.toString().trim());
    }
}
