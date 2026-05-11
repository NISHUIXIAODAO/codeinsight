package com.codeinsight.api.repo;

import com.codeinsight.api.entity.ParseResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ParseResultRepository extends JpaRepository<ParseResultEntity, String> {
    Optional<ParseResultEntity> findFirstByProjectIdOrderByCreatedAtDesc(String projectId);

    long countByProjectId(String projectId);

    void deleteByProjectId(String projectId);
}
