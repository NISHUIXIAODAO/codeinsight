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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PineconeClient {

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Pinecone Inference API base url（用于生成 embeddings）：
     * - https://api.pinecone.io
     */
    @Value("${pinecone.base-url:https://api.pinecone.io}")
    private String pineconeBaseUrl;

    /**
     * Pinecone Index Host（用于 upsert/query），在 Pinecone 控制台里可看到，形如：
     * - https://{index}-{project}.svc.{region}.pinecone.io
     */
    @Value("${pinecone.index-host:}")
    private String indexHost;

    @Value("${pinecone.api-key:${PINECONE_API_KEY:}}")
    private String apiKey;

    /**
     * Pinecone Inference API 版本（必须带）
     * 文档示例：2025-10
     */
    @Value("${pinecone.api-version:2025-10}")
    private String apiVersion;

    /**
     * 嵌入模型，Pinecone 文档示例：multilingual-e5-large / llama-text-embed-v2
     */
    @Value("${pinecone.embed-model:llama-text-embed-v2}")
    private String embedModel;

    public float[] embedQuery(String text) {
        List<String> one = new ArrayList<String>();
        one.add(text);
        List<float[]> r = embedTexts(one, "query");
        return r.isEmpty() ? null : r.get(0);
    }

    public List<float[]> embedPassages(List<String> texts) {
        return embedTexts(texts, "passage");
    }

    /**
     * 调用 Pinecone Inference API 生成 embeddings。
     * 参考：POST https://api.pinecone.io/embed（需要 Api-Key 和 X-Pinecone-Api-Version）
     */
    public List<float[]> embedTexts(List<String> texts, String inputType) {
        ensureApiKey();
        String url = normalizeBaseUrl(pineconeBaseUrl) + "/embed";

        List<Map<String, Object>> inputs = new ArrayList<Map<String, Object>>();
        for (String t : texts) {
            if (t == null) continue;
            Map<String, Object> obj = new HashMap<String, Object>();
            obj.put("text", t);
            inputs.add(obj);
        }

        Map<String, Object> parameters = new HashMap<String, Object>();
        parameters.put("truncate", "END");
        if (inputType != null && !inputType.trim().isEmpty()) {
            parameters.put("input_type", inputType);
        }

        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("model", embedModel);
        payload.put("inputs", inputs);
        payload.put("parameters", parameters);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Api-Key", apiKey.trim());
        headers.set("X-Pinecone-Api-Version", apiVersion);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<Map<String, Object>>(payload, headers);
        ResponseEntity<String> resp;
        try {
            resp = restTemplate.postForEntity(url, entity, String.class);
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException("Pinecone embed failed: HTTP " + e.getRawStatusCode() + " - " + safeTruncate(e.getResponseBodyAsString(), 1200), e);
        }

        String body = resp.getBody();
        if (body == null) throw new RuntimeException("Pinecone embed returned empty body");

        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode data = root.get("data");
            if (data == null || !data.isArray()) throw new RuntimeException("Pinecone embed response missing data");

            List<float[]> out = new ArrayList<float[]>();
            for (JsonNode item : data) {
                JsonNode values = item.get("values");
                if (values == null || !values.isArray()) continue;
                float[] vec = new float[values.size()];
                for (int i = 0; i < values.size(); i++) {
                    vec[i] = (float) values.get(i).asDouble();
                }
                out.add(vec);
            }
            return out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Pinecone embed response", e);
        }
    }

    /**
     * Upsert 向量到 Pinecone Index。
     */
    public void upsert(String namespace, List<PineconeVector> vectors) {
        ensureApiKey();
        ensureIndexHost();

        String url = normalizeBaseUrl(indexHost) + "/vectors/upsert";

        List<Map<String, Object>> v = new ArrayList<Map<String, Object>>();
        for (PineconeVector pv : vectors) {
            Map<String, Object> one = new HashMap<String, Object>();
            one.put("id", pv.getId());
            one.put("values", pv.getValues());
            if (pv.getMetadata() != null) one.put("metadata", pv.getMetadata());
            v.add(one);
        }

        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("vectors", v);
        if (namespace != null && !namespace.trim().isEmpty()) payload.put("namespace", namespace);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Api-Key", apiKey.trim());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<Map<String, Object>>(payload, headers);
        try {
            restTemplate.postForEntity(url, entity, String.class);
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException("Pinecone upsert failed: HTTP " + e.getRawStatusCode() + " - " + safeTruncate(e.getResponseBodyAsString(), 1200), e);
        }
    }

    /**
     * 向量检索（TopK）。
     */
    public List<PineconeMatch> query(String namespace, float[] vector, int topK) {
        ensureApiKey();
        ensureIndexHost();

        String url = normalizeBaseUrl(indexHost) + "/query";
        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("topK", Math.max(1, topK));
        payload.put("includeMetadata", true);
        payload.put("vector", toList(vector));
        if (namespace != null && !namespace.trim().isEmpty()) payload.put("namespace", namespace);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Api-Key", apiKey.trim());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<Map<String, Object>>(payload, headers);
        ResponseEntity<String> resp;
        try {
            resp = restTemplate.postForEntity(url, entity, String.class);
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException("Pinecone query failed: HTTP " + e.getRawStatusCode() + " - " + safeTruncate(e.getResponseBodyAsString(), 1200), e);
        }

        String body = resp.getBody();
        if (body == null) throw new RuntimeException("Pinecone query returned empty body");

        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode matches = root.get("matches");
            if (matches == null || !matches.isArray()) return new ArrayList<PineconeMatch>();

            List<PineconeMatch> out = new ArrayList<PineconeMatch>();
            for (JsonNode m : matches) {
                String id = m.get("id") == null ? null : m.get("id").asText();
                double score = m.get("score") == null ? 0 : m.get("score").asDouble();
                Map<String, Object> meta = null;
                JsonNode metaNode = m.get("metadata");
                if (metaNode != null && metaNode.isObject()) {
                    meta = objectMapper.convertValue(metaNode, Map.class);
                }
                if (id != null) out.add(new PineconeMatch(id, score, meta));
            }
            return out;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Pinecone query response", e);
        }
    }

    private void ensureApiKey() {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing PINECONE_API_KEY (or pinecone.api-key)");
        }
    }

    private void ensureIndexHost() {
        if (indexHost == null || indexHost.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing pinecone.index-host");
        }
    }

    private static String normalizeBaseUrl(String u) {
        if (u == null) return "";
        String s = u.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    private static List<Float> toList(float[] v) {
        List<Float> out = new ArrayList<Float>();
        if (v == null) return out;
        for (float x : v) out.add(x);
        return out;
    }

    private static String safeTruncate(String s, int limit) {
        if (s == null) return null;
        String v = s.trim();
        if (v.length() <= limit) return v;
        return v.substring(0, limit) + "...(truncated)";
    }
}
