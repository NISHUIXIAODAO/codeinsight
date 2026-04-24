package com.codeinsight.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public class CopilotSessionDto {
    private String id;
    @JsonProperty("project_id")
    private String projectId;
    private String title;
    @JsonProperty("last_mode")
    private String lastMode;
    @JsonProperty("updated_at")
    private Instant updatedAt;

    public CopilotSessionDto() {
    }

    public CopilotSessionDto(String id, String projectId, String title, String lastMode, Instant updatedAt) {
        this.id = id;
        this.projectId = projectId;
        this.title = title;
        this.lastMode = lastMode;
        this.updatedAt = updatedAt;
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getLastMode() {
        return lastMode;
    }

    public void setLastMode(String lastMode) {
        this.lastMode = lastMode;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}

