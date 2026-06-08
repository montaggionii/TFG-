package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.AdminLog;

import java.util.List;

public interface AdminLogDAO extends JpaRepository<AdminLog, Long> {
    List<AdminLog> findTop20ByOrderByCreatedAtDesc();
}
