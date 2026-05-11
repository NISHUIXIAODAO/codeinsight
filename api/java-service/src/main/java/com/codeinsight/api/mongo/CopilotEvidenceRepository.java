package com.codeinsight.api.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface CopilotEvidenceRepository extends MongoRepository<CopilotEvidenceDoc, String> {
    void deleteBySessionIdIn(Iterable<String> sessionIds);
}
