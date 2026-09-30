package com.example.CodeChefProject.exception;

/**
 * Thrown when an event (or any other resource) cannot be found for the given id.
 * Mapped to HTTP 404 by {@link GlobalExceptionHandler}.
 */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}

	public static ResourceNotFoundException event(Long id) {
		return new ResourceNotFoundException("No contest or event found with id " + id);
	}
}
