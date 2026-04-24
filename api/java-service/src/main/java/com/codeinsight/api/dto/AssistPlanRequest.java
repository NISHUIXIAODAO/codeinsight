package com.codeinsight.api.dto;

public class AssistPlanRequest {
    /**
     * 项目 ID（可选）。如果传了，会把该项目的依赖图谱摘要注入到模型上下文中。
     */
    private String project_id;

    /**
     * 用户的需求描述（必填）。
     */
    private String requirement;

    /**
     * 额外约束（可选），例如：
     * - 不允许改动数据库结构
     * - 只能新增文件，禁止改动旧文件
     * - 必须补单测/接口联调步骤
     */
    private String constraints;

    /**
     * 是否启用思考模式（可选）。
     * - false：deepseek-chat
     * - true：deepseek-reasoner
     */
    private Boolean thinking;

    public String getProject_id() {
        return project_id;
    }

    public void setProject_id(String project_id) {
        this.project_id = project_id;
    }

    public String getRequirement() {
        return requirement;
    }

    public void setRequirement(String requirement) {
        this.requirement = requirement;
    }

    public String getConstraints() {
        return constraints;
    }

    public void setConstraints(String constraints) {
        this.constraints = constraints;
    }

    public Boolean getThinking() {
        return thinking;
    }

    public void setThinking(Boolean thinking) {
        this.thinking = thinking;
    }
}

