package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> storage = new HashMap<>();
        storage.put("type", "h2");
        Map<String, Object> payload = new HashMap<>();
        payload.put("status", "ok");
        payload.put("storage", storage);
        return ApiResponse.ok(payload, "ok");
    }
}
