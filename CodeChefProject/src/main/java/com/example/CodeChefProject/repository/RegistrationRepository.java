package com.example.CodeChefProject.repository;

import com.example.CodeChefProject.model.Registration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Data access for student registrations. Every query that feeds the admin
 * console does a {@code join fetch} on the event so the DTO mapping never
 * triggers a lazy load outside of the transaction.
 */
@Repository
public interface RegistrationRepository extends JpaRepository<Registration, Long> {

	/** Duplicate guard: the same email may not register twice for one event. */
	boolean existsByEmailIgnoreCaseAndEventId(String email, Long eventId);

	List<Registration> findAllByOrderByRegisteredAtDesc();

	List<Registration> findByEventIdOrderByRegisteredAtDesc(Long eventId);

	/** Free text search on student name / email / college / phone. */
	@Query("""
			select r from Registration r
			join fetch r.event
			where lower(r.studentName) like :keyword
			   or lower(r.email) like :keyword
			   or lower(r.collegeOrYear) like :keyword
			   or lower(r.phoneNumber) like :keyword
			order by r.registeredAt desc
			""")
	List<Registration> searchAll(@Param("keyword") String keyword);

	/** Free text search restricted to one event. */
	@Query("""
			select r from Registration r
			join fetch r.event e
			where e.id = :eventId
			  and (lower(r.studentName) like :keyword
			   or lower(r.email) like :keyword
			   or lower(r.collegeOrYear) like :keyword
			   or lower(r.phoneNumber) like :keyword)
			order by r.registeredAt desc
			""")
	List<Registration> searchByEventId(@Param("eventId") Long eventId, @Param("keyword") String keyword);

	@Query("select r from Registration r join fetch r.event e order by r.registeredAt desc")
	List<Registration> findAllWithEvent();

	@Query("select r from Registration r join fetch r.event e where e.id = :eventId order by r.registeredAt desc")
	List<Registration> findByEventIdWithEvent(@Param("eventId") Long eventId);

	long countByEventId(Long eventId);

	/** Removes every registration of an event before the event itself is deleted. */
	long deleteByEventId(Long eventId);
}
