package com.codeinsight.api.repo;

import com.codeinsight.api.entity.TaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface TaskRepository extends JpaRepository<TaskEntity, String> {
    Page<TaskEntity> findByProjectId(String projectId, Pageable pageable);

    Page<TaskEntity> findByStatus(String status, Pageable pageable);

    Page<TaskEntity> findByTaskType(String taskType, Pageable pageable);

    Page<TaskEntity> findByProjectIdAndStatus(String projectId, String status, Pageable pageable);

    Page<TaskEntity> findByProjectIdAndTaskType(String projectId, String taskType, Pageable pageable);

    Page<TaskEntity> findByStatusAndTaskType(String status, String taskType, Pageable pageable);

    Page<TaskEntity> findByProjectIdAndStatusAndTaskType(String projectId, String status, String taskType, Pageable pageable);

    long countByStatusIn(Collection<String> statuses);

    void deleteByStatusIn(Collection<String> statuses);
}
