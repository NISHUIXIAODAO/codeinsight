package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.CodeChatRequest;
import com.codeinsight.api.dto.CodeChatResponse;
import com.codeinsight.api.service.CodeChatService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/code")
public class CodeChatController {

    private final CodeChatService codeChatService;

    public CodeChatController(CodeChatService codeChatService) {
        this.codeChatService = codeChatService;
    }

    /**
     * 与代码对话（向量检索 + RAG）。
     */
    @PostMapping("/chat")
    public ApiResponse<CodeChatResponse> chat(@RequestBody CodeChatRequest req) {
        return ApiResponse.ok(codeChatService.chat(req));
    }
}

