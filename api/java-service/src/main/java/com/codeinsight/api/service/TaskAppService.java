package com.codeinsight.api.service;

import com.codeinsight.api.dto.TaskDto;
import com.codeinsight.api.entity.TaskEntity;
import com.codeinsight.api.repo.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TaskAppService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<Map<String, Object>>() {};

    private final TaskRepository taskRepository;
    private final JsonCodec jsonCodec;

    public TaskAppService(TaskRepository taskRepository, JsonCodec jsonCodec) {
        this.taskRepository = taskRepository;
        this.jsonCodec = jsonCodec;
    }

    public List<TaskDto> listTasks(String projectId, String status, String taskType, int limit) {
        int size = Math.min(Math.max(limit, 1), 200);
        PageRequest pageable = PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<TaskEntity> page;
        boolean hasProject = projectId != null && !projectId.trim().isEmpty();
        boolean hasStatus = status != null && !status.trim().isEmpty();
        boolean hasType = taskType != null && !taskType.trim().isEmpty();

        if (hasProject && hasStatus && hasType) {
            page = taskRepository.findByProjectIdAndStatusAndTaskType(projectId, status, taskType, pageable);
        } else if (hasProject && hasStatus) {
            page = taskRepository.findByProjectIdAndStatus(projectId, status, pageable);
        } else if (hasProject && hasType) {
            page = taskRepository.findByProjectIdAndTaskType(projectId, taskType, pageable);
        } else if (hasStatus && hasType) {
            page = taskRepository.findByStatusAndTaskType(status, taskType, pageable);
        } else if (hasProject) {
            page = taskRepository.findByProjectId(projectId, pageable);
        } else if (hasStatus) {
            page = taskRepository.findByStatus(status, pageable);
        } else if (hasType) {
            page = taskRepository.findByTaskType(taskType, pageable);
        } else {
            page = taskRepository.findAll(pageable);
        }

        return page.stream().map(this::toDto).collect(Collectors.toList());
    }

    public TaskDto getTask(String id) {
        TaskEntity t = taskRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("task not found"));
        return toDto(t);
    }

    private TaskDto toDto(TaskEntity t) {
        Object config = jsonCodec.fromJson(t.getConfig(), MAP_TYPE);
        Object result = jsonCodec.fromJson(t.getResult(), MAP_TYPE);
        return new TaskDto(
                t.getId(),
                t.getProjectId(),
                t.getTaskType(),
                t.getStatus(),
                config,
                result,
                t.getCreatedAt(),
                t.getCompletedAt()
        );
    }
}
