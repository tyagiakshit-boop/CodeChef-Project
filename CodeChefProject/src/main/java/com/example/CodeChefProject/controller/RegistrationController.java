package com.example.CodeChefProject.controller;

import com.example.CodeChefProject.dto.RegistrationRequest;
import com.example.CodeChefProject.dto.RegistrationResponse;
import com.example.CodeChefProject.service.RegistrationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Student registrations. {@code POST} is public (student side),
 * {@code GET} powers the admin "Registered Students" tab. CORS stays open so the
 * same endpoints keep working when the pages are previewed from another origin.
 */
@CrossOrigin
@RestController
@RequestMapping("/api/registrations")
public class RegistrationController {

	private final RegistrationService registrationService;

	public RegistrationController(RegistrationService registrationService) {
		this.registrationService = registrationService;
	}

	@GetMapping
	public List<RegistrationResponse> listRegistrations(
			@RequestParam(required = false) String search,
			@RequestParam(required = false) Long eventId) {
		return registrationService.findRegistrations(search, eventId);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RegistrationResponse register(@Valid @RequestBody RegistrationRequest request) {
		return registrationService.register(request);
	}
}
