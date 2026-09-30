package com.example.CodeChefProject.exception;

/**
 * Thrown when a student tries to register twice for the same event with the same
 * email address. Mapped to HTTP 409 by {@link GlobalExceptionHandler}.
 */
public class DuplicateRegistrationException extends RuntimeException {

	public DuplicateRegistrationException(String message) {
		super(message);
	}

	public static DuplicateRegistrationException forEmail(String email, String eventName) {
		return new DuplicateRegistrationException("The email " + email
				+ " is already registered for \"" + eventName + "\". One account per contest, chef!");
	}
}
