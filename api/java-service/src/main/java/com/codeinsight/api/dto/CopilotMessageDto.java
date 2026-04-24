package com.codeinsight.api.dto;

import java.time.Instant;
import java.util.List;

public class CopilotMessageDto {
    private String id;
    private String session_id;
    private String project_id;
    private String mode;
    private String role;
    private String content;
    private String reasoning;
    private List<CodeCitation> citations;
    private Instant created_at;

    public CopilotMessageDto() {
    }

    public CopilotMessageDto(
            String id,
            String session_id,
            String project_id,
            String mode,
            String role,
            String content,
            String reasoning,
            List<CodeCitation> citations,
            Instant created_at
    ) {
        this.id = id;
        this.session_id = session_id;
        this.project_id = project_id;
        this.mode = mode;
        this.role = role;
        this.content = content;
        this.reasoning = reasoning;
        this.citations = citations;
        this.created_at = created_at;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSession_id() {
        return session_id;
    }

    public void setSession_id(String session_id) {
        this.session_id = session_id;
    }

    public String getProject_id() {
        return project_id;
    }

    public void setProject_id(String project_id) {
        this.project_id = project_id;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getReasoning() {
        return reasoning;
    }

    public void setReasoning(String reasoning) {
        this.reasoning = reasoning;
    }

    public List<CodeCitation> getCitations() {
        return citations;
    }

    public void setCitations(List<CodeCitation> citations) {
        this.citations = citations;
    }

    public Instant getCreated_at() {
        return created_at;
    }

    public void setCreated_at(Instant created_at) {
        this.created_at = created_at;
    }
}

