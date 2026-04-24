package com.codeinsight.api.controller;

import com.codeinsight.api.dto.ApiResponse;
import com.codeinsight.api.dto.CopilotMessageDto;
import com.codeinsight.api.dto.CopilotMessageRequest;
import com.codeinsight.api.dto.CopilotMessageResponse;
import com.codeinsight.api.dto.CopilotSessionDto;
import com.codeinsight.api.service.CopilotService;
import com.codeinsight.api.service.CopilotStreamListener;
import com.codeinsight.api.service.JsonCodec;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/copilot")
public class CopilotController {

    private final CopilotService copilotService;
    private final JsonCodec jsonCodec;

    public CopilotController(CopilotService copilotService, JsonCodec jsonCodec) {
        this.copilotService = copilotService;
        this.jsonCodec = jsonCodec;
    }

    /**
     * 统一入口：chat / code / plan 三种模式都走这里。
     * 这样前端只维护一个 Copilot 页面，减少模块冗余。
     */
    @PostMapping("/message")
    public ApiResponse<CopilotMessageResponse> message(@RequestBody CopilotMessageRequest req) {
        return ApiResponse.ok(copilotService.send(req));
    }

    @PostMapping(value = "/message/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter messageStream(@RequestBody CopilotMessageRequest req) {
        SseEmitter emitter = new SseEmitter(0L);

        CompletableFuture.runAsync(() -> {
            copilotService.stream(req, new CopilotStreamListener() {
                @Override
                public void onMeta(CopilotMessageResponse meta) {
                    try {
                        emitter.send(SseEmitter.event().name("meta").data(jsonCodec.toJson(meta)));
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                }

                @Override
                public void onDelta(String contentDelta, String reasoningDelta) {
                    try {
                        Map<String, Object> payload = new LinkedHashMap<String, Object>();
                        payload.put("content_delta", contentDelta);
                        payload.put("reasoning_delta", reasoningDelta);
                        emitter.send(SseEmitter.event().name("delta").data(jsonCodec.toJson(payload)));
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                }

                @Override
                public void onDone(CopilotMessageResponse done) {
                    try {
                        emitter.send(SseEmitter.event().name("done").data(jsonCodec.toJson(done)));
                        emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                }

                @Override
                public void onError(String message) {
                    try {
                        Map<String, Object> payload = new LinkedHashMap<String, Object>();
                        payload.put("error", message);
                        emitter.send(SseEmitter.event().name("error").data(jsonCodec.toJson(payload)));
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                        return;
                    }
                    emitter.complete();
                }
            });
        });

        return emitter;
    }

    /**
     * 获取项目下的会话列表（用于会话切换/历史续聊）。
     */
    @GetMapping("/sessions")
    public ApiResponse<List<CopilotSessionDto>> sessions(@RequestParam("project_id") String projectId) {
        return ApiResponse.ok(copilotService.listSessions(projectId));
    }

    @GetMapping("/messages")
    public ApiResponse<List<CopilotMessageDto>> messages(
            @RequestParam("session_id") String sessionId,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        int n = limit == null ? 80 : limit;
        return ApiResponse.ok(copilotService.listMessages(sessionId, n));
    }
}
