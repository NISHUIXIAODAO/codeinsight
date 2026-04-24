package com.codeinsight.api.service;

public class DeepseekChatResult {
    private final String content;
    private final String reasoningContent;

    public DeepseekChatResult(String content, String reasoningContent) {
        this.content = content;
        this.reasoningContent = reasoningContent;
    }

    public String getContent() {
        return content;
    }

    public String getReasoningContent() {
        return reasoningContent;
    }
}

