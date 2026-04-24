package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.GraphData;
import com.codeinsight.api.dto.IndexRequest;
import com.codeinsight.api.dto.ProjectDto;
import com.codeinsight.api.dto.ProjectImportRequest;
import com.codeinsight.api.dto.ProjectParseRequest;
import com.codeinsight.api.service.ProjectAppService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
public class ProjectsController {
    private final ProjectAppService projectAppService;

    public ProjectsController(ProjectAppService projectAppService) {
        this.projectAppService = projectAppService;
    }

    @GetMapping
    public ApiResponse<List<ProjectDto>> list() {
        return ApiResponse.ok(projectAppService.listProjects());
    }

    @PostMapping("/import")
    public ResponseEntity<ApiResponse<ProjectDto>> importProject(@Valid @RequestBody ProjectImportRequest req) {
        ProjectDto created = projectAppService.importProject(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    @PostMapping("/{id}/parse")
    public ResponseEntity<ApiResponse<Map<String, Object>>> parse(@PathVariable("id") String id, @Valid @RequestBody ProjectParseRequest req) {
        String taskId = projectAppService.createParseTask(id, req.getPath().trim());
        Map<String, Object> payload = new HashMap<>();
        payload.put("task_id", taskId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok(payload));
    }

    /**
     * 对项目做“代码索引”（向量检索用）。
     * 说明：这是 Plan/Chat 之前的准备步骤，索引完成后才能做到“与代码对话”。
     */
    @PostMapping("/{id}/index")
    public ResponseEntity<ApiResponse<Map<String, Object>>> index(@PathVariable("id") String id, @RequestBody IndexRequest req) {
        String path = req == null ? null : req.getPath();
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("path is required");
        }
        String taskId = projectAppService.createIndexTask(id, path.trim());
        Map<String, Object> payload = new HashMap<>();
        payload.put("task_id", taskId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok(payload));
    }

    @GetMapping("/{id}/dependencies")
    public ApiResponse<GraphData> dependencies(@PathVariable("id") String id) {
        GraphData data = projectAppService.getDependencies(id);
        return ApiResponse.ok(data);
    }
}
