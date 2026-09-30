package com.example.CodeChefProject.repository;

import com.example.CodeChefProject.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Data access for campus CodeChef events.
 */
@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

	/* ------------------------------------------------------------------ *
	 *  Listing (always ordered so the "Contests & Events" table reads
	 *  like the CodeChef contest calendar: soonest contest first).
	 * ------------------------------------------------------------------ */

	List<Event> findAllByOrderByEventDateAscEventTimeAsc();

	/** Case-insensitive search on the event name. */
	List<Event> findByNameContainingIgnoreCaseOrderByEventDateAscEventTimeAsc(String name);

	/** Filter by category, e.g. "Rated Contest" or "DSA Workshop". */
	List<Event> findByCategoryIgnoreCaseOrderByEventDateAscEventTimeAsc(String category);

	/** Case-insensitive search on the event name + category filter. */
	List<Event> findByNameContainingIgnoreCaseAndCategoryIgnoreCaseOrderByEventDateAscEventTimeAsc(
			String name, String category);

	/* ------------------------------------------------------------------ *
	 *  Featured contests / events
	 * ------------------------------------------------------------------ */

	List<Event> findByFeaturedTrueOrderByEventDateAscEventTimeAsc();

	List<Event> findByNameContainingIgnoreCaseAndFeaturedTrueOrderByEventDateAscEventTimeAsc(String name);

	long countByFeaturedTrue();

	/* ------------------------------------------------------------------ *
	 *  Helpers used by the admin console filters
	 * ------------------------------------------------------------------ */

	boolean existsByNameIgnoreCase(String name);

	@Query("select distinct e.category from Event e order by e.category asc")
	List<String> findDistinctCategories();

	@Query("select count(e) from Event e where e.eventDate >= :today")
	long countUpcoming(@Param("today") java.time.LocalDate today);
}
