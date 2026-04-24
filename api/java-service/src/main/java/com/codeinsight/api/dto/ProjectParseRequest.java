package com.codeinsight.api.dto;

import jakarta.validation.constraints.NotBlank;

public class ProjectParseRequest {
    @NotBlank
    private String path;

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
