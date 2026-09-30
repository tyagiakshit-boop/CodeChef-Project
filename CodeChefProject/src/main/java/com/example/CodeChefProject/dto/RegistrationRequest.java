package com.example.CodeChefProject.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Payload sent by the student side registration modal
 * ({@code POST /api/registrations}).
 */
@Getter
@Setter
@NoArgsConstructor
public class RegistrationRequest {

	@NotNull(message = "Please pick a contest or event to register for")
	private Long eventId;

	@NotBlank(message = "Student name is required")
	@Size(max = 120, message = "Student name must be at most 120 characters")
	private String studentName;

	@NotBlank(message = "Email is required")
	@Email(message = "Enter a valid email address (e.g. coder@college.edu)")
	@Size(max = 160, message = "Email must be at most 160 characters")
	private String email;

	@NotBlank(message = "College / Year is required")
	@Size(max = 120, message = "College / Year must be at most 120 characters")
	private String collegeOrYear;

	@NotBlank(message = "Phone number is required")
	@Pattern(regexp = "^[0-9+][0-9 ()-]{7,19}$",
			message = "Enter a valid phone number (8-20 digits, may include +, spaces, - or ())")
	private String phoneNumber;
}
