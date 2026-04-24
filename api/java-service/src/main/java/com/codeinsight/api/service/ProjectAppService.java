package com.codeinsight.api.service;

import com.codeinsight.api.dto.GraphData;
import com.codeinsight.api.dto.ProjectDto;
import com.codeinsight.api.dto.ProjectImportRequest;
import com.codeinsight.api.entity.ParseResultEntity;
import com.codeinsight.api.entity.ProjectEntity;
import com.codeinsight.api.entity.TaskEntity;
import com.codeinsight.api.repo.ParseResultRepository;
import com.codeinsight.api.repo.ProjectRepository;
import com.codeinsight.api.repo.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProjectAppService {
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final ParseResultRepository parseResultRepository;
    private final RepoGraphService repoGraphService;
    private final JsonCodec jsonCodec;
    private final KafkaProducerService kafkaProducerService;

    public ProjectAppService(
            ProjectRepository projectRepository,
            TaskRepository taskRepository,
            ParseResultRepository parseResultRepository,
            RepoGraphService repoGraphService,
            JsonCodec jsonCodec,
            KafkaProducerService kafkaProducerService
    ) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.parseResultRepository = parseResultRepository;
        this.repoGraphService = repoGraphService;
        this.jsonCodec = jsonCodec;
        this.kafkaProducerService = kafkaProducerService;
    }

    public List<ProjectDto> listProjects() {
        return projectRepository
                .findAll(Sort.by(Sort.Direction.DESC, "updatedAt"))
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectDto importProject(ProjectImportRequest req) {
        ProjectEntity p = new ProjectEntity();
        p.setName(req.getName().trim());
        p.setUrl(req.getUrl() == null || req.getUrl().trim().isEmpty() ? null : req.getUrl().trim());
        p.setLanguage(req.getLanguage() == null || req.getLanguage().trim().isEmpty() ? null : req.getLanguage().trim());
        p.setStatus("imported");
        p = projectRepository.save(p);

        String path = req.getPath() == null || req.getPath().trim().isEmpty() ? null : req.getPath().trim();
        TaskEntity t = new TaskEntity();
        t.setProjectId(p.getId());
        t.setTaskType("parse");
        t.setStatus("pending");
        Map<String, Object> cfg = new HashMap<>();
        cfg.put("url", req.getUrl());
        cfg.put("path", path);
        cfg.put("language", req.getLanguage());
        t.setConfig(jsonCodec.toJson(cfg));
        t = taskRepository.save(t);

        if (path != null) {
            kafkaProducerService.sendParseTask(t.getId(), p.getId(), path);
        }

        // 可选：导入时顺便触发一次“代码索引”，用于后续“与代码对话”（向量检索）。
        // 如果你不想默认索引，可以把这段逻辑挪到一个独立按钮接口里。
        if (path != null) {
            createIndexTask(p.getId(), path);
        }

        return toDto(p);
    }

    @Transactional
    public String createParseTask(String projectId, String path) {
        ProjectEntity p = projectRepository.findById(projectId).orElseThrow(() -> new IllegalArgumentException("project not found"));
        TaskEntity t = new TaskEntity();
        t.setProjectId(p.getId());
        t.setTaskType("parse");
        t.setStatus("pending");
        Map<String, Object> cfg = new HashMap<>();
        cfg.put("path", path);
        t.setConfig(jsonCodec.toJson(cfg));
        t = taskRepository.save(t);
        kafkaProducerService.sendParseTask(t.getId(), p.getId(), path);
        return t.getId();
    }

    @Transactional
    public String createIndexTask(String projectId, String path) {
        ProjectEntity p = projectRepository.findById(projectId).orElseThrow(() -> new IllegalArgumentException("project not found"));
        TaskEntity t = new TaskEntity();
        t.setProjectId(p.getId());
        t.setTaskType("index");
        t.setStatus("pending");
        Map<String, Object> cfg = new HashMap<>();
        cfg.put("path", path);
        t.setConfig(jsonCodec.toJson(cfg));
        t = taskRepository.save(t);
        kafkaProducerService.sendIndexTask(t.getId(), p.getId(), path);
        return t.getId();
    }

    public GraphData getDependencies(String projectId) {
        Optional<ParseResultEntity> pr = parseResultRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId);
        if (!pr.isPresent()) return new GraphData(new ArrayList<>(), new ArrayList<>());
        GraphData data = jsonCodec.fromJson(pr.get().getDependencies(), new TypeReference<GraphData>() {});
        if (data == null || data.getNodes() == null || data.getLinks() == null) return new GraphData(new ArrayList<>(), new ArrayList<>());
        return data;
    }

    @Transactional
    public void executeParseAsync(String taskId, String projectId, String path) {
        TaskEntity t = taskRepository.findById(taskId).orElse(null);
        ProjectEntity p = projectRepository.findById(projectId).orElse(null);
        if (t == null || p == null) return;

        try {
            t.setStatus("running");
            taskRepository.save(t);

            GraphData graph = repoGraphService.buildGraph(path);
            ParseResultEntity pr = new ParseResultEntity();
            pr.setProjectId(projectId);
            pr.setDependencies(jsonCodec.toJson(graph));
            parseResultRepository.save(pr);

            t.setStatus("completed");
            t.setCompletedAt(Instant.now());
            Map<String, Object> ok = new HashMap<>();
            ok.put("ok", true);
            t.setResult(jsonCodec.toJson(ok));
            taskRepository.save(t);

            p.setStatus("parsed");
            projectRepository.save(p);
        } catch (Exception e) {
            TaskEntity te = taskRepository.findById(taskId).orElse(null);
            if (te != null) {
                te.setStatus("failed");
                te.setCompletedAt(Instant.now());
                Map<String, Object> err = new HashMap<>();
                err.put("error", e.getMessage());
                te.setResult(jsonCodec.toJson(err));
                taskRepository.save(te);
            }
            ProjectEntity pe = projectRepository.findById(projectId).orElse(null);
            if (pe != null) {
                pe.setStatus("failed");
                projectRepository.save(pe);
            }
        }
    }

    private ProjectDto toDto(ProjectEntity p) {
        return new ProjectDto(
                p.getId(),
                p.getName(),
                p.getUrl(),
                p.getLanguage(),
                p.getStatus(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
