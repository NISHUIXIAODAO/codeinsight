package com.codeinsight.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public class TaskDto {
    private String id;
    @JsonProperty("project_id")
    private String projectId;
    @JsonProperty("task_type")
    private String taskType;
    private String status;
    private Object config;
    private Object result;
    @JsonProperty("created_at")
    private Instant createdAt;
    @JsonProperty("completed_at")
    private Instant completedAt;

    public TaskDto() {
    }

    public TaskDto(String id, String projectId, String taskType, String status, Object config, Object result, Instant createdAt, Instant completedAt) {
        this.id = id;
        this.projectId = projectId;
        this.taskType = taskType;
        this.status = status;
        this.config = config;
        this.result = result;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Object getConfig() {
        return config;
    }

    public void setConfig(Object config) {
        this.config = config;
    }

    public Object getResult() {
        return result;
    }

    public void setResult(Object result) {
        this.result = result;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }
}
