package com.codeinsight.api.dto;

import java.util.List;

public class GraphNode {
    private String id;
    private String name;
    private String type;
    private String packageName;
    private String language;
    private String role;
    private String fqn;
    private Boolean isInterface;
    private List<String> stereotypes;
    private Integer count;
    private String owner;

    public GraphNode() {
    }

    public GraphNode(String id, String name, String type, String packageName, String language, String role, String fqn, Boolean isInterface, List<String> stereotypes, Integer count, String owner) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.packageName = packageName;
        this.language = language;
        this.role = role;
        this.fqn = fqn;
        this.isInterface = isInterface;
        this.stereotypes = stereotypes;
        this.count = count;
        this.owner = owner;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getPackageName() {
        return packageName;
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getFqn() {
        return fqn;
    }

    public void setFqn(String fqn) {
        this.fqn = fqn;
    }

    public Boolean getIsInterface() {
        return isInterface;
    }

    public void setIsInterface(Boolean anInterface) {
        isInterface = anInterface;
    }

    public List<String> getStereotypes() {
        return stereotypes;
    }

    public void setStereotypes(List<String> stereotypes) {
        this.stereotypes = stereotypes;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }
}
