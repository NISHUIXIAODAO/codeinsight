package com.codeinsight.api.repo;

import com.codeinsight.api.entity.CodeChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;

public interface CodeChunkRepository extends JpaRepository<CodeChunkEntity, String> {
    @Modifying
    void deleteByProjectId(String projectId);

    List<CodeChunkEntity> findByProjectIdAndIdIn(String projectId, List<String> ids);
}
