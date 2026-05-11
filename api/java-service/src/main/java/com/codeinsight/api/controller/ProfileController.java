package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.service.ProfileMaintenanceService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final ProfileMaintenanceService profileMaintenanceService;

    public ProfileController(ProfileMaintenanceService profileMaintenanceService) {
        this.profileMaintenanceService = profileMaintenanceService;
    }

    @GetMapping("/export")
    public ApiResponse<Map<String, Object>> exportData() {
        return ApiResponse.ok(profileMaintenanceService.exportData());
    }

    @DeleteMapping("/copilot-history")
    public ApiResponse<Map<String, Object>> clearCopilotHistory() {
        return ApiResponse.ok(profileMaintenanceService.clearCopilotHistory());
    }

    @DeleteMapping("/tasks/history")
    public ApiResponse<Map<String, Object>> clearHistoricalTasks() {
        return ApiResponse.ok(profileMaintenanceService.clearHistoricalTasks());
    }

    @DeleteMapping("/project-caches")
    public ApiResponse<Map<String, Object>> clearProjectCaches() {
        return ApiResponse.ok(profileMaintenanceService.clearProjectCaches());
    }
}
