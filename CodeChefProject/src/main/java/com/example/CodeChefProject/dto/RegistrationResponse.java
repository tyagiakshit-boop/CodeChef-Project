package com.example.CodeChefProject.dto;

import com.example.CodeChefProject.model.Registration;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Flattened view of a {@link Registration} for the admin "Registered Students"
 * table so the lazy {@code event} association is never serialised directly.
 */
@Getter
@Setter
@NoArgsConstructor
public class RegistrationResponse {

	private Long id;
	private String studentName;
	private String email;
	private String collegeOrYear;
	private String phoneNumber;
	private LocalDateTime registeredAt;

	private Long eventId;
	private String eventName;
	private String eventCategory;
	private LocalDate eventDate;
	private LocalTime eventTime;

	/** Requires the {@code event} association to be initialised. */
	public static RegistrationResponse from(Registration registration) {
		RegistrationResponse dto = new RegistrationResponse();
		dto.id = registration.getId();
		dto.studentName = registration.getStudentName();
		dto.email = registration.getEmail();
		dto.collegeOrYear = registration.getCollegeOrYear();
		dto.phoneNumber = registration.getPhoneNumber();
		dto.registeredAt = registration.getRegisteredAt();
		if (registration.getEvent() != null) {
			dto.eventId = registration.getEvent().getId();
			dto.eventName = registration.getEvent().getName();
			dto.eventCategory = registration.getEvent().getCategory();
			dto.eventDate = registration.getEvent().getEventDate();
			dto.eventTime = registration.getEvent().getEventTime();
		}
		return dto;
	}
}
