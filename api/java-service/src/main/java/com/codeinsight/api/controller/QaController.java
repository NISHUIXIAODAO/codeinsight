package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.QaRequest;
import com.codeinsight.api.dto.QaResponse;
import com.codeinsight.api.service.QaService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/qa")
public class QaController {

    private final QaService qaService;

    public QaController(QaService qaService) {
        this.qaService = qaService;
    }

    @PostMapping
    public ApiResponse<QaResponse> qa(@RequestBody QaRequest req) {
        return ApiResponse.ok(qaService.ask(req));
    }
}

