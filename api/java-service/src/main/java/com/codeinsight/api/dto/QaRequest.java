package com.codeinsight.api.dto;

public class QaRequest {
    private String project_id;
    private String question;
    private String context;
    /**
     * 是否启用“思考模式”：
     * - false：使用 deepseek-chat（非思考模式）
     * - true：使用 deepseek-reasoner（思考模式）
     */
    private Boolean thinking;

    public String getProject_id() {
        return project_id;
    }

    public void setProject_id(String project_id) {
        this.project_id = project_id;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public Boolean getThinking() {
        return thinking;
    }

    public void setThinking(Boolean thinking) {
        this.thinking = thinking;
    }
}
