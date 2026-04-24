package com.codeinsight.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class KafkaProducerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaProducerService.class);
    private static final String TOPIC = "code-analysis-tasks";

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private JsonCodec jsonCodec;

    public void sendParseTask(String taskId, String projectId, String path) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("taskId", taskId);
            message.put("projectId", projectId);
            message.put("type", "parse");
            
            Map<String, Object> config = new HashMap<>();
            config.put("path", path);
            message.put("config", config);
            
            message.put("timestamp", System.currentTimeMillis());
            
            String json = jsonCodec.toJson(message);
            kafkaTemplate.send(TOPIC, taskId, json);
            log.info("Sent parse task to Kafka topic [{}]: {}", TOPIC, json);
        } catch (Exception e) {
            log.error("Failed to send parse task to Kafka", e);
        }
    }

    public void sendIndexTask(String taskId, String projectId, String path) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("taskId", taskId);
            message.put("projectId", projectId);
            message.put("type", "index");

            Map<String, Object> config = new HashMap<>();
            config.put("path", path);
            message.put("config", config);

            message.put("timestamp", System.currentTimeMillis());

            String json = jsonCodec.toJson(message);
            kafkaTemplate.send(TOPIC, taskId, json);
            log.info("Sent index task to Kafka topic [{}]: {}", TOPIC, json);
        } catch (Exception e) {
            log.error("Failed to send index task to Kafka", e);
        }
    }
}
