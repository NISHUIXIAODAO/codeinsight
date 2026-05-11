package com.codeinsight.api.repo;

import com.codeinsight.api.entity.CopilotSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CopilotSessionRepository extends JpaRepository<CopilotSessionEntity, String> {
    List<CopilotSessionEntity> findByProjectIdOrderByUpdatedAtDesc(String projectId);

    List<CopilotSessionEntity> findAllByOrderByUpdatedAtDesc();
}
