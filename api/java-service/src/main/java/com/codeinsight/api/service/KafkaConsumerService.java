package com.codeinsight.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class KafkaConsumerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerService.class);
    private static final String TOPIC = "code-analysis-tasks";

    @Autowired
    private ProjectAppService projectAppService;

    @Autowired
    private CodeIndexService codeIndexService;

    @Autowired
    private JsonCodec jsonCodec;

    @KafkaListener(topics = TOPIC, groupId = "${spring.kafka.consumer.group-id}")
    public void listen(String message) {
        try {
            log.info("Received message from Kafka topic [{}]: {}", TOPIC, message);
            Map<String, Object> taskMap = jsonCodec.fromJson(message, new TypeReference<Map<String, Object>>() {});
            
            String taskId = (String) taskMap.get("taskId");
            String projectId = (String) taskMap.get("projectId");
            String type = (String) taskMap.get("type");
            
            if ("parse".equals(type) && taskId != null && projectId != null) {
                Map<String, Object> config = (Map<String, Object>) taskMap.get("config");
                String path = config != null ? (String) config.get("path") : null;
                
                if (path != null) {
                    log.info("Triggering async parse execution for taskId={}, projectId={}", taskId, projectId);
                    projectAppService.executeParseAsync(taskId, projectId, path);
                } else {
                    log.warn("Missing 'path' in config for taskId={}", taskId);
                }
            } else if ("index".equals(type) && taskId != null && projectId != null) {
                Map<String, Object> config = (Map<String, Object>) taskMap.get("config");
                String path = config != null ? (String) config.get("path") : null;

                if (path != null) {
                    log.info("Triggering code index for taskId={}, projectId={}", taskId, projectId);
                    codeIndexService.indexProject(taskId, projectId, path);
                } else {
                    log.warn("Missing 'path' in config for index taskId={}", taskId);
                }
            } else {
                log.warn("Invalid task message or unsupported type: {}", type);
            }
        } catch (Exception e) {
            log.error("Error processing Kafka message", e);
        }
    }
}
