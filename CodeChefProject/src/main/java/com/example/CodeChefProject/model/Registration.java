package com.example.CodeChefProject.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

/**
 * A student registration for a CodeChef chapter event.
 * <p>
 * The {@code (email, event_id)} unique constraint plus the DB level
 * {@code on delete cascade} keep the data clean: a student can register for the
 * same contest only once and deleting an event never leaves orphan rows or
 * broken foreign keys behind.
 */
@Entity
@Table(name = "registrations",
		uniqueConstraints = @UniqueConstraint(name = "uk_registration_email_event",
				columnNames = { "email", "event_id" }))
@Getter
@Setter
@NoArgsConstructor
public class Registration {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@NotBlank(message = "Student name is required")
	@Size(max = 120, message = "Student name must be at most 120 characters")
	@Column(name = "student_name", nullable = false, length = 120)
	private String studentName;

	@NotBlank(message = "Email is required")
	@Email(message = "Enter a valid email address")
	@Size(max = 160, message = "Email must be at most 160 characters")
	@Column(nullable = false, length = 160)
	private String email;

	@NotBlank(message = "College / Year is required")
	@Size(max = 120, message = "College / Year must be at most 120 characters")
	@Column(name = "college_or_year", nullable = false, length = 120)
	private String collegeOrYear;

	@NotBlank(message = "Phone number is required")
	@Size(max = 20, message = "Phone number must be at most 20 characters")
	@Column(name = "phone_number", nullable = false, length = 20)
	private String phoneNumber;

	@Column(name = "registered_at", nullable = false, updatable = false)
	private LocalDateTime registeredAt;

	@JsonIgnore
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "event_id", nullable = false,
			foreignKey = @ForeignKey(name = "fk_registration_event"))
	@OnDelete(action = OnDeleteAction.CASCADE)
	private Event event;

	public Registration(String studentName, String email, String collegeOrYear,
			String phoneNumber, Event event) {
		this.studentName = studentName;
		this.email = email;
		this.collegeOrYear = collegeOrYear;
		this.phoneNumber = phoneNumber;
		this.event = event;
	}

	@PrePersist
	void applyDefaults() {
		if (registeredAt == null) {
			registeredAt = LocalDateTime.now();
		}
	}
}
