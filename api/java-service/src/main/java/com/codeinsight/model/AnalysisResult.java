package com.codeinsight.model;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

public class AnalysisResult {
    private String projectId;
    private List<ClassInfo> classes = new ArrayList<>();
    private List<Map<String, String>> dependencies = new ArrayList<>();

    public AnalysisResult(String projectId) {
        this.projectId = projectId;
    }

    // Getters and Setters
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public List<ClassInfo> getClasses() { return classes; }
    public void setClasses(List<ClassInfo> classes) { this.classes = classes; }
    public List<Map<String, String>> getDependencies() { return dependencies; }
    public void setDependencies(List<Map<String, String>> dependencies) { this.dependencies = dependencies; }

    public void addDependency(String source, String target, String type) {
        Map<String, String> dep = new HashMap<>();
        dep.put("source", source);
        dep.put("target", target);
        dep.put("type", type);
        dependencies.add(dep);
    }
}
