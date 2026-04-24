package com.codeinsight.api.service;

public interface DeepseekStreamListener {
    void onDelta(String contentDelta, String reasoningDelta);
}

