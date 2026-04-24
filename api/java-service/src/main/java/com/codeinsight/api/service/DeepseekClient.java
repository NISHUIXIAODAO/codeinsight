package com.codeinsight.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeepseekClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * DeepSeek API 兼容 OpenAI 的 Chat Completions。
     * 文档：base_url 可以是 https://api.deepseek.com 或 https://api.deepseek.com/v1。
     */
    @Value("${deepseek.base-url:https://api.deepseek.com}")
    private String baseUrl;

    /**
     * DeepSeek 官方提供两个主要模型名（OpenAI 兼容接口）：
     * - deepseek-chat：非思考模式
     * - deepseek-reasoner：思考模式
     */
    @Value("${deepseek.model.chat:deepseek-chat}")
    private String chatModel;

    @Value("${deepseek.model.reasoner:deepseek-reasoner}")
    private String reasonerModel;

    /**
     * 建议把 Key 放在环境变量里，不要写入代码仓库。
     * 运行时设置：DEEPSEEK_API_KEY=xxxxx
     */
    @Value("${deepseek.api-key:${deepseek.api_key:${DEEPSEEK_API_KEY:}}}")
    private String apiKey;

    public String chat(List<Map<String, String>> messages) {
        return chat(messages, false);
    }

    public String chat(List<Map<String, String>> messages, boolean thinking) {
        DeepseekChatResult r = chatWithReasoning(messages, thinking);
        return r.getContent();
    }

    /**
     * 同时返回：
     * - content：最终回答
     * - reasoning_content：推理过程（仅 deepseek-reasoner 可能返回）
     *
     * DeepSeek 文档说明 reasoning_content 在 message 结构中与 content 同级。
     */
    public DeepseekChatResult chatWithReasoning(List<Map<String, String>> messages, boolean thinking) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing DEEPSEEK_API_KEY");
        }

        String url = normalizeBaseUrl(baseUrl) + "/chat/completions";

        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("model", thinking ? reasonerModel : chatModel);
        payload.put("messages", messages);
        payload.put("temperature", 0.2);
        payload.put("stream", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey.trim());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<Map<String, Object>>(payload, headers);
        ResponseEntity<String> resp;
        try {
            resp = restTemplate.postForEntity(url, entity, String.class);
        } catch (HttpStatusCodeException e) {
            String body = e.getResponseBodyAsString();
            String msg = "DeepSeek HTTP " + e.getRawStatusCode() + " " + e.getStatusText();
            if (body != null && !body.trim().isEmpty()) {
                msg = msg + " - " + safeTruncate(body, 1200);
            }
            throw new RuntimeException(msg, e);
        }

        if (!resp.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("DeepSeek request failed with status " + resp.getStatusCodeValue());
        }

        String body = resp.getBody();
        if (body == null) throw new RuntimeException("Empty response from DeepSeek");

        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode choices = root.get("choices");
            if (choices == null || !choices.isArray() || choices.size() == 0) {
                throw new RuntimeException("DeepSeek response missing choices");
            }
            JsonNode msg = choices.get(0).get("message");
            if (msg == null) throw new RuntimeException("DeepSeek response missing message");
            String content = readText(msg, "content");
            if (content == null || content.trim().isEmpty()) throw new RuntimeException("DeepSeek returned empty content");

            String reasoning = readText(msg, "reasoning_content");
            if (reasoning != null && reasoning.trim().isEmpty()) reasoning = null;

            return new DeepseekChatResult(content, reasoning);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse DeepSeek response", e);
        }
    }

    public DeepseekChatResult streamChatWithReasoning(List<Map<String, String>> messages, boolean thinking, DeepseekStreamListener listener) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing DEEPSEEK_API_KEY");
        }

        String url = normalizeBaseUrl(baseUrl) + "/chat/completions";

        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("model", thinking ? reasonerModel : chatModel);
        payload.put("messages", messages);
        payload.put("temperature", 0.2);
        payload.put("stream", true);

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize DeepSeek request", e);
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(5))
                .header("Authorization", "Bearer " + apiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

        HttpResponse<java.util.stream.Stream<String>> resp;
        try {
            resp = httpClient.send(req, HttpResponse.BodyHandlers.ofLines());
        } catch (Exception e) {
            throw new RuntimeException("DeepSeek stream request failed", e);
        }

        if (resp.statusCode() / 100 != 2) {
            try {
                String err = resp.body().collect(java.util.stream.Collectors.joining("\n"));
                throw new RuntimeException("DeepSeek HTTP " + resp.statusCode() + " - " + safeTruncate(err, 1200));
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception e) {
                throw new RuntimeException("DeepSeek HTTP " + resp.statusCode());
            }
        }

        StringBuilder content = new StringBuilder();
        StringBuilder reasoning = new StringBuilder();

        try (java.util.stream.Stream<String> lines = resp.body()) {
            java.util.Iterator<String> it = lines.iterator();
            while (it.hasNext()) {
                String line = it.next();
                if (line == null) continue;
                String t = line.trim();
                if (t.isEmpty()) continue;

                String data;
                if (t.startsWith("data:")) {
                    data = t.substring(5).trim();
                } else if (t.startsWith("{")) {
                    data = t;
                } else {
                    continue;
                }

                if (data.isEmpty()) continue;
                if ("[DONE]".equals(data)) break;

                try {
                    JsonNode root = objectMapper.readTree(data);
                    JsonNode choices = root.get("choices");
                    if (choices == null || !choices.isArray() || choices.size() == 0) continue;
                    JsonNode delta = choices.get(0).get("delta");
                    if (delta == null) continue;

                    String c = readText(delta, "content");
                    String r = readText(delta, "reasoning_content");
                    if (c != null && !c.isEmpty()) content.append(c);
                    if (r != null && !r.isEmpty()) reasoning.append(r);

                    if (listener != null && ((c != null && !c.isEmpty()) || (r != null && !r.isEmpty()))) {
                        listener.onDelta(c, r);
                    }
                } catch (Exception ignored) {
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to read DeepSeek stream", e);
        }

        String finalContent = content.toString().trim();
        if (finalContent.isEmpty()) {
            throw new RuntimeException("DeepSeek returned empty content");
        }

        String finalReasoning = reasoning.toString().trim();
        if (finalReasoning.isEmpty()) finalReasoning = null;

        return new DeepseekChatResult(finalContent, finalReasoning);
    }

    private static String normalizeBaseUrl(String u) {
        if (u == null) return "https://api.deepseek.com";
        String s = u.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (s.endsWith("/v1")) s = s.substring(0, s.length() - 3);
        return s;
    }

    private static String safeTruncate(String s, int limit) {
        if (s == null) return null;
        String v = s.trim();
        if (v.length() <= limit) return v;
        return v.substring(0, limit) + "...(truncated)";
    }

    private static String readText(JsonNode obj, String key) {
        if (obj == null || key == null) return null;
        JsonNode n = obj.get(key);
        return n == null ? null : n.asText();
    }
}
