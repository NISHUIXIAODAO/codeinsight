package com.codeinsight.model;

import java.util.List;
import java.util.ArrayList;

public class ClassInfo {
    private String name;
    private String packageName;
    private List<MethodInfo> methods = new ArrayList<>();
    private List<String> fields = new ArrayList<>();
    private List<String> dependencies = new ArrayList<>();

    public ClassInfo(String name, String packageName) {
        this.name = name;
        this.packageName = packageName;
    }

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPackageName() { return packageName; }
    public void setPackageName(String packageName) { this.packageName = packageName; }
    public List<MethodInfo> getMethods() { return methods; }
    public void setMethods(List<MethodInfo> methods) { this.methods = methods; }
    public List<String> getFields() { return fields; }
    public void setFields(List<String> fields) { this.fields = fields; }
    public List<String> getDependencies() { return dependencies; }
    public void setDependencies(List<String> dependencies) { this.dependencies = dependencies; }
}
