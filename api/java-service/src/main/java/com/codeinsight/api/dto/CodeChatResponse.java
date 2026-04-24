package com.codeinsight.api.dto;

import java.util.List;

public class CodeChatResponse {
    private String answer;
    private String reasoning;
    private List<CodeCitation> citations;

    public CodeChatResponse() {
    }

    public CodeChatResponse(String answer, String reasoning, List<CodeCitation> citations) {
        this.answer = answer;
        this.reasoning = reasoning;
        this.citations = citations;
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

    public List<CodeCitation> getCitations() {
        return citations;
    }

    public void setCitations(List<CodeCitation> citations) {
        this.citations = citations;
    }
}

