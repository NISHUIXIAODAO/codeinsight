package com.codeinsight.api.service;

import com.codeinsight.api.entity.CodeChunkEntity;
import com.codeinsight.api.entity.CopilotMessageEntity;
import com.codeinsight.api.entity.CopilotSessionEntity;
import com.codeinsight.api.entity.ParseResultEntity;
import com.codeinsight.api.entity.ProjectEntity;
import com.codeinsight.api.entity.ProjectMemoryEntity;
import com.codeinsight.api.entity.TaskEntity;
import com.codeinsight.api.mongo.CodeChunkDocRepository;
import com.codeinsight.api.mongo.CopilotEvidenceRepository;
import com.codeinsight.api.repo.CodeChunkRepository;
import com.codeinsight.api.repo.CopilotMessageRepository;
import com.codeinsight.api.repo.CopilotSessionRepository;
import com.codeinsight.api.repo.ParseResultRepository;
import com.codeinsight.api.repo.ProjectMemoryRepository;
import com.codeinsight.api.repo.ProjectRepository;
import com.codeinsight.api.repo.TaskRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ProfileMaintenanceService {
    private static final List<String> HISTORICAL_TASK_STATUSES = Arrays.asList("completed", "failed");

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final CopilotSessionRepository copilotSessionRepository;
    private final CopilotMessageRepository copilotMessageRepository;
    private final ParseResultRepository parseResultRepository;
    private final CodeChunkRepository codeChunkRepository;
    private final CodeChunkDocRepository codeChunkDocRepository;
    private final ProjectMemoryRepository projectMemoryRepository;
    private final CopilotEvidenceRepository copilotEvidenceRepository;

    public ProfileMaintenanceService(
            ProjectRepository projectRepository,
            TaskRepository taskRepository,
            CopilotSessionRepository copilotSessionRepository,
            CopilotMessageRepository copilotMessageRepository,
            ParseResultRepository parseResultRepository,
            CodeChunkRepository codeChunkRepository,
            CodeChunkDocRepository codeChunkDocRepository,
            ProjectMemoryRepository projectMemoryRepository,
            CopilotEvidenceRepository copilotEvidenceRepository
    ) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.copilotSessionRepository = copilotSessionRepository;
        this.copilotMessageRepository = copilotMessageRepository;
        this.parseResultRepository = parseResultRepository;
        this.codeChunkRepository = codeChunkRepository;
        this.codeChunkDocRepository = codeChunkDocRepository;
        this.projectMemoryRepository = projectMemoryRepository;
        this.copilotEvidenceRepository = copilotEvidenceRepository;
    }

    public Map<String, Object> exportData() {
        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("exported_at", Instant.now().toString());
        payload.put("projects", projectRepository.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")));
        payload.put("tasks", taskRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")));
        payload.put("copilot_sessions", copilotSessionRepository.findAllByOrderByUpdatedAtDesc());
        payload.put("copilot_messages", copilotMessageRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt")));
        return payload;
    }

    @Transactional
    public Map<String, Object> clearCopilotHistory() {
        List<CopilotSessionEntity> sessions = copilotSessionRepository.findAll();
        List<String> sessionIds = sessions.stream().map(CopilotSessionEntity::getId).collect(Collectors.toList());

        long messageCount = sessionIds.isEmpty() ? 0 : copilotMessageRepository.findBySessionIdIn(sessionIds).size();
        if (!sessionIds.isEmpty()) {
            copilotMessageRepository.deleteBySessionIdIn(sessionIds);
            copilotSessionRepository.deleteAllById(sessionIds);
            try {
                copilotEvidenceRepository.deleteBySessionIdIn(sessionIds);
            } catch (Exception ignored) {
            }
        }

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("deleted_sessions", sessions.size());
        result.put("deleted_messages", messageCount);
        return result;
    }

    @Transactional
    public Map<String, Object> clearHistoricalTasks() {
        long count = taskRepository.countByStatusIn(HISTORICAL_TASK_STATUSES);
        taskRepository.deleteByStatusIn(HISTORICAL_TASK_STATUSES);

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("deleted_tasks", count);
        result.put("statuses", HISTORICAL_TASK_STATUSES);
        return result;
    }

    @Transactional
    public Map<String, Object> clearProjectCaches() {
        List<ProjectEntity> projects = projectRepository.findAll();
        List<Map<String, Object>> perProject = new ArrayList<Map<String, Object>>();
        long parseResults = 0;
        long codeChunks = 0;
        long memories = 0;

        for (ProjectEntity project : projects) {
            String projectId = project.getId();
            long projectParseResults = parseResultRepository.countByProjectId(projectId);
            long projectCodeChunks = codeChunkRepository.countByProjectId(projectId);
            long projectMemories = projectMemoryRepository.countByProjectId(projectId);

            parseResultRepository.deleteByProjectId(projectId);
            codeChunkRepository.deleteByProjectId(projectId);
            projectMemoryRepository.deleteByProjectId(projectId);
            try {
                codeChunkDocRepository.deleteByProjectId(projectId);
            } catch (Exception ignored) {
            }

            if ("parsed".equals(project.getStatus()) || "indexed".equals(project.getStatus()) || "completed".equals(project.getStatus())) {
                project.setStatus("imported");
                projectRepository.save(project);
            }

            parseResults += projectParseResults;
            codeChunks += projectCodeChunks;
            memories += projectMemories;

            Map<String, Object> row = new LinkedHashMap<String, Object>();
            row.put("project_id", projectId);
            row.put("parse_results", projectParseResults);
            row.put("code_chunks", projectCodeChunks);
            row.put("project_memories", projectMemories);
            perProject.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("projects_touched", projects.size());
        result.put("deleted_parse_results", parseResults);
        result.put("deleted_code_chunks", codeChunks);
        result.put("deleted_project_memories", memories);
        result.put("details", perProject);
        return result;
    }
}
