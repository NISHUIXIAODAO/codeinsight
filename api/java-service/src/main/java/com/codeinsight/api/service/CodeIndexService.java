package com.codeinsight.api.service;

import com.codeinsight.api.entity.CodeChunkEntity;
import com.codeinsight.api.entity.ProjectEntity;
import com.codeinsight.api.entity.TaskEntity;
import com.codeinsight.api.mongo.CodeChunkDoc;
import com.codeinsight.api.mongo.CodeChunkDocRepository;
import com.codeinsight.api.repo.CodeChunkRepository;
import com.codeinsight.api.repo.ProjectRepository;
import com.codeinsight.api.repo.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CodeIndexService {

    private static final Set<String> IGNORE_DIRS = new HashSet<String>();
    static {
        IGNORE_DIRS.add(".git");
        IGNORE_DIRS.add(".idea");
        IGNORE_DIRS.add(".vscode");
        IGNORE_DIRS.add("node_modules");
        IGNORE_DIRS.add("dist");
        IGNORE_DIRS.add("build");
        IGNORE_DIRS.add("out");
        IGNORE_DIRS.add("coverage");
        IGNORE_DIRS.add(".next");
        IGNORE_DIRS.add(".nuxt");
        IGNORE_DIRS.add("target");
        IGNORE_DIRS.add(".venv");
        IGNORE_DIRS.add("venv");
        IGNORE_DIRS.add("__pycache__");
    }

    private static final Set<String> ALLOWED_EXT = new HashSet<String>();
    static {
        // 先覆盖最常见的源码与文档类型，后续你可以按需要扩展
        ALLOWED_EXT.add(".java");
        ALLOWED_EXT.add(".kt");
        ALLOWED_EXT.add(".ts");
        ALLOWED_EXT.add(".tsx");
        ALLOWED_EXT.add(".js");
        ALLOWED_EXT.add(".jsx");
        ALLOWED_EXT.add(".py");
        ALLOWED_EXT.add(".md");
        ALLOWED_EXT.add(".txt");
        ALLOWED_EXT.add(".yml");
        ALLOWED_EXT.add(".yaml");
        ALLOWED_EXT.add(".json");
        ALLOWED_EXT.add(".xml");
        ALLOWED_EXT.add(".properties");
    }

    private final PineconeClient pineconeClient;
    private final CodeChunkRepository codeChunkRepository;
    private final CodeChunkDocRepository codeChunkDocRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final JsonCodec jsonCodec;

    public CodeIndexService(
            PineconeClient pineconeClient,
            CodeChunkRepository codeChunkRepository,
            CodeChunkDocRepository codeChunkDocRepository,
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            JsonCodec jsonCodec
    ) {
        this.pineconeClient = pineconeClient;
        this.codeChunkRepository = codeChunkRepository;
        this.codeChunkDocRepository = codeChunkDocRepository;
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.jsonCodec = jsonCodec;
    }

    /**
     * 对一个项目进行代码索引：
     * 1) 扫描文件
     * 2) 按行切分为 chunk（带重叠）
     * 3) chunk 入库（H2）
     * 4) 生成 embeddings 并 upsert 到 Pinecone（namespace=projectId）
     *
     * 注意：这是 MVP 版本，后续可以升级为“按函数/类边界切块”以提升检索质量。
     */
    @Transactional
    public void indexProject(String taskId, String projectId, String rootPath) {
        TaskEntity task = taskRepository.findById(taskId).orElse(null);
        ProjectEntity project = projectRepository.findById(projectId).orElse(null);
        if (task == null || project == null) return;

        try {
            task.setStatus("running");
            taskRepository.save(task);

            Path root = Paths.get(rootPath).toAbsolutePath().normalize();
            if (!Files.exists(root) || !Files.isDirectory(root)) {
                throw new IllegalArgumentException("Invalid project path: " + rootPath);
            }

            // 简化处理：每次索引先清空旧 chunk，保证 Pinecone/DB 不会积累重复数据
            codeChunkRepository.deleteByProjectId(projectId);
            codeChunkDocRepository.deleteByProjectId(projectId);

            List<Path> files = listFiles(root);

            int fileCount = 0;
            int chunkCount = 0;

            // 批处理：减少 embedding / upsert 的网络请求次数
            List<CodeChunkEntity> pendingChunks = new ArrayList<CodeChunkEntity>();
            List<String> pendingTexts = new ArrayList<String>();

            for (Path file : files) {
                fileCount++;
                String rel = toPosix(root.relativize(file).toString());
                List<Chunk> chunks = chunkFile(file);
                for (Chunk c : chunks) {
                    CodeChunkEntity e = new CodeChunkEntity();
                    e.setId(UUID.randomUUID().toString());
                    e.setProjectId(projectId);
                    e.setFilePath(rel);
                    e.setStartLine(c.startLine);
                    e.setEndLine(c.endLine);
                    e.setContent("");
                    codeChunkRepository.save(e);

                    CodeChunkDoc d = new CodeChunkDoc();
                    d.setId(e.getId());
                    d.setProjectId(projectId);
                    d.setFilePath(rel);
                    d.setStartLine(c.startLine);
                    d.setEndLine(c.endLine);
                    d.setContent(c.content);
                    d.setCreatedAt(Instant.now());
                    codeChunkDocRepository.save(d);

                    pendingChunks.add(e);
                    pendingTexts.add(buildEmbeddingText(rel, c));
                    chunkCount++;

                    if (pendingChunks.size() >= 32) {
                        flushToPinecone(projectId, pendingChunks, pendingTexts);
                        pendingChunks.clear();
                        pendingTexts.clear();
                    }
                }
            }

            if (!pendingChunks.isEmpty()) {
                flushToPinecone(projectId, pendingChunks, pendingTexts);
            }

            task.setStatus("completed");
            task.setCompletedAt(Instant.now());
            Map<String, Object> result = new HashMap<String, Object>();
            result.put("files", fileCount);
            result.put("chunks", chunkCount);
            task.setResult(jsonCodec.toJson(result));
            taskRepository.save(task);

            project.setStatus("indexed");
            projectRepository.save(project);
        } catch (Exception e) {
            task.setStatus("failed");
            task.setCompletedAt(Instant.now());
            Map<String, Object> err = new HashMap<String, Object>();
            err.put("error", e.getMessage());
            task.setResult(jsonCodec.toJson(err));
            taskRepository.save(task);

            project.setStatus("failed");
            projectRepository.save(project);
        }
    }

    private void flushToPinecone(String projectId, List<CodeChunkEntity> chunks, List<String> texts) {
        List<float[]> vectors = pineconeClient.embedPassages(texts);
        if (vectors.size() != chunks.size()) {
            throw new RuntimeException("Embedding size mismatch: vectors=" + vectors.size() + ", chunks=" + chunks.size());
        }

        List<PineconeVector> upserts = new ArrayList<PineconeVector>();
        for (int i = 0; i < chunks.size(); i++) {
            CodeChunkEntity c = chunks.get(i);
            float[] v = vectors.get(i);

            Map<String, Object> meta = new LinkedHashMap<String, Object>();
            meta.put("filePath", c.getFilePath());
            meta.put("startLine", c.getStartLine());
            meta.put("endLine", c.getEndLine());

            upserts.add(new PineconeVector(c.getId(), toList(v), meta));
        }

        // namespace 用 projectId，这样查询时不用额外 filter
        pineconeClient.upsert(projectId, upserts);
    }

    private static List<Float> toList(float[] v) {
        List<Float> out = new ArrayList<Float>();
        for (float x : v) out.add(x);
        return out;
    }

    private static String buildEmbeddingText(String relPath, Chunk c) {
        // 把路径/行号作为“弱特征”拼进去，能帮助一些包含文件名的查询更准
        return "FILE: " + relPath + "\n" +
                "LINES: " + c.startLine + "-" + c.endLine + "\n" +
                c.content;
    }

    private static List<Path> listFiles(Path root) throws IOException {
        List<Path> out = new ArrayList<Path>();
        Files.walkFileTree(root, new FileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                String name = dir.getFileName() == null ? "" : dir.getFileName().toString();
                if (IGNORE_DIRS.contains(name)) return FileVisitResult.SKIP_SUBTREE;
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (!attrs.isRegularFile()) return FileVisitResult.CONTINUE;
                String p = file.toString().toLowerCase();
                for (String ext : ALLOWED_EXT) {
                    if (p.endsWith(ext)) {
                        // 过滤超大文件，避免 embedding 花费过高
                        try {
                            long size = Files.size(file);
                            if (size <= 800_000) out.add(file);
                        } catch (Exception ignored) {
                            out.add(file);
                        }
                        break;
                    }
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) {
                return FileVisitResult.CONTINUE;
            }
        });
        return out;
    }

    private static List<Chunk> chunkFile(Path file) {
        // chunk 参数：窗口大小 + 重叠
        final int window = 120;
        final int overlap = 20;
        final int step = Math.max(1, window - overlap);

        List<String> lines = new ArrayList<String>();
        try (BufferedReader br = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String line;
            while ((line = br.readLine()) != null) {
                lines.add(line);
                if (lines.size() > 5000) break; // 防止极端文件
            }
        } catch (Exception e) {
            return new ArrayList<Chunk>();
        }

        List<Chunk> chunks = new ArrayList<Chunk>();
        int n = lines.size();
        int start = 0;
        while (start < n) {
            int end = Math.min(n, start + window);
            StringBuilder sb = new StringBuilder();
            for (int i = start; i < end; i++) {
                sb.append(lines.get(i)).append("\n");
            }
            String content = sb.toString().trim();
            if (!content.isEmpty()) {
                Chunk c = new Chunk();
                c.startLine = start + 1;
                c.endLine = end;
                c.content = content;
                chunks.add(c);
            }
            if (end == n) break;
            start += step;
        }

        return chunks;
    }

    private static String toPosix(String p) {
        return p.replace('\\', '/');
    }

    private static class Chunk {
        int startLine;
        int endLine;
        String content;
    }
}
