package com.example.CodeChefProject.controller;

import com.example.CodeChefProject.model.Event;
import com.example.CodeChefProject.service.EventService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * REST API for the campus CodeChef contest / event calendar.
 * Write operations are used by the admin console. CORS stays open so the same
 * endpoints keep working when the pages are previewed from another origin.
 */
@CrossOrigin
@RestController
@RequestMapping("/api/events")
public class EventController {

	private final EventService eventService;

	public EventController(EventService eventService) {
		this.eventService = eventService;
	}

	/**
	 * Lists contests & events.
	 *
	 * @param search   optional case-insensitive name search
	 * @param category optional category filter ("All" or blank for every category)
	 * @param featured optional flag to fetch just the featured contests
	 */
	@GetMapping
	public List<Event> listEvents(@RequestParam(required = false) String search,
			@RequestParam(required = false) String category,
			@RequestParam(required = false) Boolean featured) {
		return eventService.findEvents(search, category, featured);
	}

	/** Canonical CodeChef chapter categories merged with the ones actually in use. */
	@GetMapping("/categories")
	public Map<String, List<String>> listCategories() {
		LinkedHashSet<String> all = new LinkedHashSet<>(EventService.CANONICAL_CATEGORIES);
		all.addAll(eventService.findCategoriesInUse());
		return Map.of(
				"canonical", List.copyOf(EventService.CANONICAL_CATEGORIES),
				"all", new ArrayList<>(all));
	}

	/** Featured contest highlighted on the home page. */
	@GetMapping("/featured")
	public Event featuredEvent() {
		return eventService.findFeaturedEvent();
	}

	@GetMapping("/{id}")
	public Event getEvent(@PathVariable Long id) {
		return eventService.findById(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Event createEvent(@Valid @RequestBody Event event) {
		return eventService.create(event);
	}

	@PutMapping("/{id}")
	public Event updateEvent(@PathVariable Long id, @Valid @RequestBody Event event) {
		return eventService.update(id, event);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteEvent(@PathVariable Long id) {
		eventService.delete(id);
	}
}
