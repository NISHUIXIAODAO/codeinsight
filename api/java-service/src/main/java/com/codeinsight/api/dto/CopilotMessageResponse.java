package com.codeinsight.api.dto;

import java.util.List;

public class CopilotMessageResponse {
    private String session_id;
    private String mode;
    private String answer;
    private String reasoning;
    private String plan_json;
    private String plan_text;
    private List<CodeCitation> citations;
    private String evidence;

    public String getSession_id() {
        return session_id;
    }

    public void setSession_id(String session_id) {
        this.session_id = session_id;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
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

    public String getPlan_json() {
        return plan_json;
    }

    public void setPlan_json(String plan_json) {
        this.plan_json = plan_json;
    }

    public String getPlan_text() {
        return plan_text;
    }

    public void setPlan_text(String plan_text) {
        this.plan_text = plan_text;
    }

    public List<CodeCitation> getCitations() {
        return citations;
    }

    public void setCitations(List<CodeCitation> citations) {
        this.citations = citations;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }
}

