package com.codeinsight.api.dto;

import java.util.List;

public class AssistPlanResponse {
    /**
     * 计划的结构化 JSON（字符串形式）。如果你后续想强类型化，可把它解析为 DTO。
     */
    private String plan_json;

    /**
     * 兼容展示的文本版（通常为 markdown），用于界面直接渲染。
     */
    private String plan_text;

    /**
     * 推理过程（如果模型返回了 reasoning_content 且 thinking=true）。
     */
    private String reasoning;

    /**
     * 本次生成计划所用到的代码引用（来自向量检索 topK）。
     * 前端可用于展示“证据来源”，也可用于后续生成补丁时定位文件。
     */
    private List<CodeCitation> citations;

    /**
     * 用于喂给模型的“证据片段”（可选，主要用于调试/演示）。
     * 注意：这里可能包含代码内容，不建议长期存库；仅用于一次请求的返回展示。
     */
    private String evidence;

    public AssistPlanResponse() {
    }

    public AssistPlanResponse(String plan_json, String plan_text, String reasoning, List<CodeCitation> citations, String evidence) {
        this.plan_json = plan_json;
        this.plan_text = plan_text;
        this.reasoning = reasoning;
        this.citations = citations;
        this.evidence = evidence;
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

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }
}
