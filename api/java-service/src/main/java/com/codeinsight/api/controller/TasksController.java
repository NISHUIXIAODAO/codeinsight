package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.TaskDto;
import com.codeinsight.api.service.TaskAppService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TasksController {
    private final TaskAppService taskAppService;

    public TasksController(TaskAppService taskAppService) {
        this.taskAppService = taskAppService;
    }

    @GetMapping
    public ApiResponse<List<TaskDto>> list(
            @RequestParam(value = "limit", required = false, defaultValue = "100") int limit,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "task_type", required = false) String taskType,
            @RequestParam(value = "project_id", required = false) String projectId
    ) {
        return ApiResponse.ok(taskAppService.listTasks(projectId, status, taskType, limit));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskDto> get(@PathVariable("id") String id) {
        return ApiResponse.ok(taskAppService.getTask(id));
    }
}
