package com.codeinsight.api.repo;

import com.codeinsight.api.entity.CopilotMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface CopilotMessageRepository extends JpaRepository<CopilotMessageEntity, String> {
    List<CopilotMessageEntity> findTop40BySessionIdOrderByCreatedAtDesc(String sessionId);

    List<CopilotMessageEntity> findBySessionIdOrderByCreatedAtDesc(String sessionId, Pageable pageable);
}
