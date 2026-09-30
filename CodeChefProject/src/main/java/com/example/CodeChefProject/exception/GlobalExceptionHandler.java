package com.example.CodeChefProject.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns every failure of the REST layer into one predictable JSON shape so the
 * CodeChef styled front end can show friendly toasts and inline field errors:
 *
 * <pre>
 * {
 *   "timestamp": "2026-09-29T15:20:11Z",
 *   "status": 400,
 *   "error": "Validation failed",
 *   "message": "Please fix the highlighted fields and try again.",
 *   "path": "/api/registrations",
 *   "fieldErrors": { "email": "Enter a valid email address..." }
 * }
 * </pre>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	public record ApiError(Instant timestamp, int status, String error, String message,
			String path, Map<String, String> fieldErrors) {

		static ApiError of(HttpStatus status, String message, String path, Map<String, String> fieldErrors) {
			return new ApiError(Instant.now(), status.value(), status.getReasonPhrase(), message, path, fieldErrors);
		}
	}

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
				ApiError.of(HttpStatus.NOT_FOUND, ex.getMessage(), request.getRequestURI(), null));
	}

	@ExceptionHandler(DuplicateRegistrationException.class)
	public ResponseEntity<ApiError> handleDuplicate(DuplicateRegistrationException ex, HttpServletRequest request) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(
				ApiError.of(HttpStatus.CONFLICT, ex.getMessage(), request.getRequestURI(), null));
	}

	/** Bean validation on {@code @Valid @RequestBody} payloads. */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiError> handleInvalidBody(MethodArgumentNotValidException ex, HttpServletRequest request) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
			fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST,
				"Please fix the highlighted fields and try again.", request.getRequestURI(), fieldErrors));
	}

	/** Bean validation triggered while flushing entities to the database. */
	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex,
			HttpServletRequest request) {
		Map<String, String> fieldErrors = ex.getConstraintViolations().stream()
				.collect(Collectors.toMap(
						violation -> lastNode(violation),
						ConstraintViolation::getMessage,
						(first, second) -> first,
						LinkedHashMap::new));
		return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST,
				"Some values are not valid.", request.getRequestURI(), fieldErrors));
	}

	/** Unique constraint (email + event) raced past the service level duplicate check. */
	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex,
			HttpServletRequest request) {
		log.warn("Data integrity violation on {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
		return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(HttpStatus.CONFLICT,
				"That record conflicts with data already stored. A student can register for the same event only once.",
				request.getRequestURI(), null));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex,
			HttpServletRequest request) {
		Throwable cause = ex.getMostSpecificCause();
		log.warn("Unreadable request body on {}: {}", request.getRequestURI(),
				cause == null ? ex.getMessage() : cause.getMessage());
		return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST,
				"Request body could not be read. Check the value types: dates as YYYY-MM-DD, "
						+ "times as HH:MM and flags such as \"featured\" as true/false.",
				request.getRequestURI(), null));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
			HttpServletRequest request) {
		return ResponseEntity.badRequest().body(ApiError.of(HttpStatus.BAD_REQUEST,
				"Invalid value for '" + ex.getName() + "'.", request.getRequestURI(), null));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
		log.error("Unhandled error on {}", request.getRequestURI(), ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiError.of(
				HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on the server. Please try again.",
				request.getRequestURI(), null));
	}

	private static String lastNode(ConstraintViolation<?> violation) {
		String path = violation.getPropertyPath().toString();
		int dot = path.lastIndexOf('.');
		return dot >= 0 ? path.substring(dot + 1) : path;
	}
}
