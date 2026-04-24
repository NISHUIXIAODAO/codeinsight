package com.codeinsight.api.service;

import java.util.Map;

public class PineconeMatch {
    private final String id;
    private final double score;
    private final Map<String, Object> metadata;

    public PineconeMatch(String id, double score, Map<String, Object> metadata) {
        this.id = id;
        this.score = score;
        this.metadata = metadata;
    }

    public String getId() {
        return id;
    }

    public double getScore() {
        return score;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }
}

