package com.example.CodeChefProject.service;

import com.example.CodeChefProject.exception.ResourceNotFoundException;
import com.example.CodeChefProject.model.Event;
import com.example.CodeChefProject.repository.EventRepository;
import com.example.CodeChefProject.repository.RegistrationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Business logic for the campus CodeChef contest / event calendar.
 */
@Service
@Transactional(readOnly = true)
public class EventService {

	/** Categories offered by the campus chapter, in the order CodeChef shows divisions. */
	public static final List<String> CANONICAL_CATEGORIES = List.of(
			"Rated Contest", "DSA Workshop", "Hackathon", "ICPC Prep", "Tech Talk");

	private static final Comparator<Event> BY_SCHEDULE = Comparator
			.comparing(Event::getEventDate, Comparator.nullsLast(Comparator.naturalOrder()))
			.thenComparing(Event::getEventTime, Comparator.nullsLast(Comparator.naturalOrder()));

	private final EventRepository eventRepository;
	private final RegistrationRepository registrationRepository;

	public EventService(EventRepository eventRepository, RegistrationRepository registrationRepository) {
		this.eventRepository = eventRepository;
		this.registrationRepository = registrationRepository;
	}

	/**
	 * Flexible listing used by {@code GET /api/events}.
	 *
	 * @param search   optional case-insensitive fragment of the event name
	 * @param category optional category filter ("All" or blank means every category)
	 * @param featured optional flag: {@code true} returns featured contests only,
	 *                 {@code false} returns the regular ones
	 */
	public List<Event> findEvents(String search, String category, Boolean featured) {
		String query = trimToNull(search);
		String wantedCategory = trimToNull(category);
		if (wantedCategory != null && "all".equalsIgnoreCase(wantedCategory)) {
			wantedCategory = null;
		}

		List<Event> events;
		if (query != null && wantedCategory != null) {
			events = eventRepository
					.findByNameContainingIgnoreCaseAndCategoryIgnoreCaseOrderByEventDateAscEventTimeAsc(query,
							wantedCategory);
		} else if (query != null) {
			events = eventRepository.findByNameContainingIgnoreCaseOrderByEventDateAscEventTimeAsc(query);
		} else if (wantedCategory != null) {
			events = eventRepository.findByCategoryIgnoreCaseOrderByEventDateAscEventTimeAsc(wantedCategory);
		} else {
			events = eventRepository.findAllByOrderByEventDateAscEventTimeAsc();
		}

		return events.stream()
				.filter(event -> featured == null || featured == event.isFeatured())
				.sorted(BY_SCHEDULE)
				.toList();
	}

	/** Categories currently present in the database (used to build the filter pills). */
	public List<String> findCategoriesInUse() {
		return eventRepository.findDistinctCategories();
	}

	/** Featured event shown in the home page spotlight, defaulting to the next upcoming contest. */
	public Event findFeaturedEvent() {
		List<Event> featured = eventRepository.findByFeaturedTrueOrderByEventDateAscEventTimeAsc();
		LocalDate today = LocalDate.now();
		return featured.stream()
				.filter(event -> !event.getEventDate().isBefore(today))
				.findFirst()
				.orElseGet(() -> featured.stream().findFirst()
						.orElseThrow(() -> new ResourceNotFoundException(
								"No featured contest is scheduled right now.")));
	}

	public Event findById(Long id) {
		return eventRepository.findById(id)
				.orElseThrow(() -> ResourceNotFoundException.event(id));
	}

	public long countEvents() {
		return eventRepository.count();
	}

	public long countFeaturedEvents() {
		return eventRepository.countByFeaturedTrue();
	}

	public long countUpcomingEvents() {
		return eventRepository.countUpcoming(LocalDate.now());
	}

	/** Quick look-up used by the "Create event" form to warn about duplicate names. */
	public Optional<Event> findByName(String name) {
		String query = trimToNull(name);
		if (query == null) {
			return Optional.empty();
		}
		return eventRepository.findByNameContainingIgnoreCaseOrderByEventDateAscEventTimeAsc(query).stream()
				.filter(event -> event.getName().equalsIgnoreCase(query))
				.findFirst();
	}

	@Transactional
	public Event create(Event payload) {
		Event event = new Event();
		event.setId(null);
		copy(payload, event);
		return eventRepository.save(event);
	}

	@Transactional
	public Event update(Long id, Event payload) {
		Event existing = findById(id);
		copy(payload, existing);
		return eventRepository.save(existing);
	}

	/**
	 * Deletes an event together with its registrations. The registrations are
	 * removed first so no foreign key constraint is ever violated, and the
	 * {@code (email, event_id)} unique index is rebuilt cleanly.
	 */
	@Transactional
	public void delete(Long id) {
		Event event = findById(id);
		registrationRepository.deleteByEventId(event.getId());
		eventRepository.delete(event);
	}

	private void copy(Event payload, Event target) {
		target.setName(payload.getName().trim());
		target.setCategory(payload.getCategory().trim());
		target.setEventDate(payload.getEventDate());
		target.setEventTime(payload.getEventTime());
		target.setVenue(payload.getVenue().trim());
		target.setDescription(payload.getDescription().trim());
		target.setFeatured(payload.isFeatured());
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
