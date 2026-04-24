package com.codeinsight.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class QaResponse {
    private String answer;

    /**
     * 推理过程（Chain-of-Thought/思考过程）。
     * 仅当使用 deepseek-reasoner 且服务端返回 reasoning_content 时才会有值。
     */
    private String reasoning;

    @JsonProperty("related_code")
    private String relatedCode;

    public QaResponse() {
    }

    public QaResponse(String answer, String reasoning, String relatedCode) {
        this.answer = answer;
        this.reasoning = reasoning;
        this.relatedCode = relatedCode;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getReasoning() {
        return reasoning;
    }

    public void setReasoning(String reasoning) {
        this.reasoning = reasoning;
    }

    public String getRelatedCode() {
        return relatedCode;
    }

    public void setRelatedCode(String relatedCode) {
        this.relatedCode = relatedCode;
    }
}
