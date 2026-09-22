package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.AdminReservation;

import java.util.List;

public interface AdminReservationDAO extends JpaRepository<AdminReservation, Long> {

    List<AdminReservation> findByDeletedFalseOrderByDateDesc();
}
