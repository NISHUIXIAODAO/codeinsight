package com.codeinsight.api.service;

import java.util.List;
import java.util.Map;

public class PineconeVector {
    private final String id;
    private final List<Float> values;
    private final Map<String, Object> metadata;

    public PineconeVector(String id, List<Float> values, Map<String, Object> metadata) {
        this.id = id;
        this.values = values;
        this.metadata = metadata;
    }

    public String getId() {
        return id;
    }

    public List<Float> getValues() {
        return values;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }
}

