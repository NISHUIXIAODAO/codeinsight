package com.codeinsight.api.repo;

import com.codeinsight.api.entity.ProjectMemoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProjectMemoryRepository extends JpaRepository<ProjectMemoryEntity, String> {
    Optional<ProjectMemoryEntity> findByProjectId(String projectId);
}

