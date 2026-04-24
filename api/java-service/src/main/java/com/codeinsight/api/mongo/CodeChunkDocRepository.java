package com.codeinsight.api.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CodeChunkDocRepository extends MongoRepository<CodeChunkDoc, String> {
    void deleteByProjectId(String projectId);
    List<CodeChunkDoc> findByProjectIdAndIdIn(String projectId, List<String> ids);
}

