package com.codeinsight.api.service;

import com.codeinsight.api.dto.CopilotMessageResponse;

public interface CopilotStreamListener {
    void onMeta(CopilotMessageResponse meta);
    void onDelta(String contentDelta, String reasoningDelta);
    void onDone(CopilotMessageResponse done);
    void onError(String message);
}

