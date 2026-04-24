package com.codeinsight.model;

import java.util.List;
import java.util.ArrayList;

public class MethodInfo {
    private String name;
    private String returnType;
    private List<String> parameters = new ArrayList<>();

    public MethodInfo(String name, String returnType) {
        this.name = name;
        this.returnType = returnType;
    }

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getReturnType() { return returnType; }
    public void setReturnType(String returnType) { this.returnType = returnType; }
    public List<String> getParameters() { return parameters; }
    public void setParameters(List<String> parameters) { this.parameters = parameters; }
}
