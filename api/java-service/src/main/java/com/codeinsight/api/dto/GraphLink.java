package com.codeinsight.api.dto;

public class GraphLink {
    private String source;
    private String target;
    private String type;
    private Integer count;

    public GraphLink() {
    }

    public GraphLink(String source, String target, String type, Integer count) {
        this.source = source;
        this.target = target;
        this.type = type;
        this.count = count;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }
}
