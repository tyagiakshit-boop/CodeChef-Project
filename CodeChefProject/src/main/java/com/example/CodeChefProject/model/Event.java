package com.example.CodeChefProject.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * A contest, workshop, hackathon or tech talk hosted by the campus CodeChef chapter.
 * <p>
 * Field level {@code jakarta.validation} constraints are enforced twice:
 * once by {@code @Valid} on the REST layer and once by Hibernate's bean validation
 * on flush, so bad data can never reach the database.
 */
@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
public class Event {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@NotBlank(message = "Event name is required")
	@Size(max = 150, message = "Event name must be at most 150 characters")
	@Column(nullable = false, length = 150)
	private String name;

	@NotBlank(message = "Category is required")
	@Size(max = 60, message = "Category must be at most 60 characters")
	@Column(nullable = false, length = 60)
	private String category;

	@NotNull(message = "Event date is required")
	@Column(name = "event_date", nullable = false)
	private LocalDate eventDate;

	@NotNull(message = "Event time is required")
	@Column(name = "event_time", nullable = false)
	private LocalTime eventTime;

	@NotBlank(message = "Venue is required")
	@Size(max = 150, message = "Venue must be at most 150 characters")
	@Column(nullable = false, length = 150)
	private String venue;

	@NotBlank(message = "Description is required")
	@Size(max = 1000, message = "Description must be at most 1000 characters")
	@Column(nullable = false, length = 1000)
	private String description;

	/** Marks the contest/event promoted in the Home page "Featured Event" spotlight. */
	@Column(nullable = false)
	private boolean featured = false;

	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt;

	public Event(String name, String category, LocalDate eventDate, LocalTime eventTime,
			String venue, String description, boolean featured) {
		this.name = name;
		this.category = category;
		this.eventDate = eventDate;
		this.eventTime = eventTime;
		this.venue = venue;
		this.description = description;
		this.featured = featured;
	}

	@PrePersist
	void applyDefaults() {
		if (createdAt == null) {
			createdAt = LocalDateTime.now();
		}
	}
}
