package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.AssistPlanRequest;
import com.codeinsight.api.dto.AssistPlanResponse;
import com.codeinsight.api.service.AssistPlanService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assist")
public class AssistController {

    private final AssistPlanService assistPlanService;

    public AssistController(AssistPlanService assistPlanService) {
        this.assistPlanService = assistPlanService;
    }

    /**
     * 一键生成改动计划（Plan Only，不直接改代码）。
     */
    @PostMapping("/plan")
    public ApiResponse<AssistPlanResponse> plan(@RequestBody AssistPlanRequest req) {
        return ApiResponse.ok(assistPlanService.generatePlan(req));
    }
}

