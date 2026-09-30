package com.example.CodeChefProject.service;

import com.example.CodeChefProject.dto.RegistrationRequest;
import com.example.CodeChefProject.dto.RegistrationResponse;
import com.example.CodeChefProject.exception.DuplicateRegistrationException;
import com.example.CodeChefProject.exception.ResourceNotFoundException;
import com.example.CodeChefProject.model.Event;
import com.example.CodeChefProject.model.Registration;
import com.example.CodeChefProject.repository.EventRepository;
import com.example.CodeChefProject.repository.RegistrationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

/**
 * Business logic for student registrations.
 */
@Service
@Transactional(readOnly = true)
public class RegistrationService {

	private final RegistrationRepository registrationRepository;
	private final EventRepository eventRepository;

	public RegistrationService(RegistrationRepository registrationRepository, EventRepository eventRepository) {
		this.registrationRepository = registrationRepository;
		this.eventRepository = eventRepository;
	}

	/** Admin listing used by {@code GET /api/registrations}. */
	public List<RegistrationResponse> findRegistrations(String search, Long eventId) {
		String keyword = trimToNull(search);
		String pattern = keyword == null ? null : "%" + keyword.toLowerCase(Locale.ROOT) + "%";

		List<Registration> registrations;
		if (pattern == null && eventId == null) {
			registrations = registrationRepository.findAllWithEvent();
		} else if (pattern == null) {
			registrations = registrationRepository.findByEventIdWithEvent(eventId);
		} else if (eventId == null) {
			registrations = registrationRepository.searchAll(pattern);
		} else {
			registrations = registrationRepository.searchByEventId(eventId, pattern);
		}

		return registrations.stream().map(RegistrationResponse::from).toList();
	}

	/**
	 * Registers a student for an event.
	 *
	 * @throws ResourceNotFoundException    if the event does not exist any more
	 * @throws DuplicateRegistrationException if the same email already registered
	 *                                        for that event
	 */
	@Transactional
	public RegistrationResponse register(RegistrationRequest request) {
		Event event = eventRepository.findById(request.getEventId())
				.orElseThrow(() -> ResourceNotFoundException.event(request.getEventId()));

		String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
		if (registrationRepository.existsByEmailIgnoreCaseAndEventId(email, event.getId())) {
			throw DuplicateRegistrationException.forEmail(email, event.getName());
		}

		Registration registration = new Registration(
				request.getStudentName().trim(),
				email,
				request.getCollegeOrYear().trim(),
				request.getPhoneNumber().trim(),
				event);

		// flush so the (email, event_id) unique index is checked inside this transaction
		Registration saved = registrationRepository.saveAndFlush(registration);
		return RegistrationResponse.from(saved);
	}

	public long countRegistrations() {
		return registrationRepository.count();
	}

	public long countForEvent(Long eventId) {
		return registrationRepository.countByEventId(eventId);
	}

	private static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
