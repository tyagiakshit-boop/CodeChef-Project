/* ==========================================================================
   admin.js - chapter admin console (admin.html)
   Talks to the Spring Boot REST API:
     GET    /api/events                          -> manage events table
     GET    /api/events/categories               -> filter + form options
     POST   /api/events                          -> create an event
     PUT    /api/events/{id}                     -> update an event
     DELETE /api/events/{id}                     -> delete an event (+ sign-ups)
     GET    /api/registrations?search=&eventId=  -> registered students table
   ========================================================================== */
(function (window, document) {
	'use strict';

	const CC = window.CC;
	const api = CC.api;
	const dom = CC.dom;
	const fmt = CC.fmt;
	const toast = CC.toast;
	const modal = CC.modal;
	const ui = CC.ui;
	const ENDPOINTS = CC.ENDPOINTS;

	const CUSTOM_CATEGORY = '__custom__';

	/** Mirrors the jakarta.validation constraints on the Event entity. */
	const LIMITS = {
		name: 150,
		category: 60,
		venue: 150,
		description: 1000
	};

	/** Used only when GET /api/events/categories is unreachable. */
	const FALLBACK_CATEGORIES = ['Rated Contest', 'DSA Workshop', 'Hackathon', 'ICPC Prep', 'Tech Talk'];

	const state = {
		events: [],
		registrations: [],
		categories: [],
		eventSearch: '',
		eventCategory: '',
		studentSearch: '',
		studentEventId: '',
		editingId: null,
		pendingDelete: null,
		saving: false
	};

	/* ----------------------------- Loading ----------------------------- */
	async function loadAll(notify) {
		showLoadingState();
		try {
			const results = await Promise.all([
				api.get(ENDPOINTS.events),
				api.get(ENDPOINTS.eventCategories),
				api.get(ENDPOINTS.registrations)
			]);
			state.events = results[0] || [];
			const categories = (results[1] && results[1].all) || [];
			state.categories = categories.length ? categories.slice() : FALLBACK_CATEGORIES.slice();
			state.registrations = results[2] || [];
			renderAll();
			if (notify) {
				toast.success('Events and registrations reloaded from the server.', 'Console refreshed');
			}
		} catch (error) {
			renderFailure(error);
			toast.fromError(error);
		}
	}

	/** Re-reads just the events (after a create / update / delete). */
	async function reloadEvents() {
		state.events = (await api.get(ENDPOINTS.events)) || [];
		if (state.editingId && !findEvent(state.editingId)) {
			state.editingId = null;
		}
		renderStats();
		renderEventTable();
		renderEventFilterOptions();
		renderCategoryOptions();
	}

	/** Re-reads just the registrations (after an event was removed). */
	async function reloadRegistrations() {
		state.registrations = (await api.get(ENDPOINTS.registrations)) || [];
		if (state.studentEventId && !findEvent(Number(state.studentEventId))) {
			state.studentEventId = '';
		}
		renderStudentTable();
		renderStats();
	}

	function showLoadingState() {
		const events = dom.$('#eventsTableBody');
		const students = dom.$('#studentsTableBody');
		if (events && !state.events.length) {
			events.innerHTML = messageRow(7, 'Fetching the chapter calendar\u2026');
		}
		if (students && !state.registrations.length) {
			students.innerHTML = messageRow(6, 'Fetching student sign-ups\u2026');
		}
	}

	function renderFailure(error) {
		const message = (error && error.message) || 'Could not load the admin data.';
		const events = dom.$('#eventsTableBody');
		const students = dom.$('#studentsTableBody');
		if (events) {
			events.innerHTML = messageRow(7, message);
		}
		if (students) {
			students.innerHTML = messageRow(6, message);
		}
		['#statTotal', '#statUpcoming', '#statRegistrations', '#statFeatured'].forEach(function (id) {
			const node = dom.$(id);
			if (node) {
				node.textContent = '\u2014';
			}
		});
	}

	/** A full width placeholder row used for loading / empty / error states. */
	function messageRow(columns, message, hint) {
		return '<tr><td colspan="' + columns + '">'
			+ ui.emptyState(message, hint || '') + '</td></tr>';
	}

	function findEvent(id) {
		const wanted = Number(id);
		return state.events.filter(function (event) {
			return Number(event.id) === wanted;
		})[0] || null;
	}

	/** eventId -> number of students signed up (built once per render pass). */
	function seatsByEvent() {
		const map = {};
		state.registrations.forEach(function (registration) {
			const key = String(registration.eventId);
			map[key] = (map[key] || 0) + 1;
		});
		return map;
	}
	/* ---------------------------- Rendering ---------------------------- */
	function renderAll() {
		renderStats();
		renderCategoryFilterOptions();
		renderCategoryOptions();
		renderEventFilterOptions();
		renderEventTable();
		renderStudentTable();
	}

	function renderStats() {
		const upcoming = state.events.filter(function (event) {
			return fmt.isUpcoming(event.eventDate, event.eventTime);
		}).length;
		const featured = state.events.filter(function (event) {
			return event.featured === true;
		}).length;

		setText('#statTotal', state.events.length);
		setText('#statUpcoming', upcoming);
		setText('#statRegistrations', state.registrations.length);
		setText('#statFeatured', featured);
		setText('#tabEventCount', state.events.length);
		setText('#tabStudentCount', state.registrations.length);
	}

	function setText(selector, value) {
		const node = dom.$(selector);
		if (node) {
			node.textContent = String(value);
		}
	}

	/** Options shared by the "Category" filter and the create/edit form. */
	function categoryValues() {
		const seen = {};
		const list = [];
		state.categories.concat(FALLBACK_CATEGORIES).forEach(function (category) {
			const label = String(category || '').trim();
			const key = label.toLowerCase();
			if (label && !seen[key]) {
				seen[key] = true;
				list.push(label);
			}
		});
		state.events.forEach(function (event) {
			const label = String(event.category || '').trim();
			const key = label.toLowerCase();
			if (label && !seen[key]) {
				seen[key] = true;
				list.push(label);
			}
		});
		return list;
	}

	function renderCategoryFilterOptions() {
		const select = dom.$('#adminCategoryFilter');
		if (!select) {
			return;
		}
		const previous = state.eventCategory;
		select.innerHTML = '<option value="">All categories</option>'
			+ categoryValues().map(function (category) {
				return '<option value="' + dom.escape(category) + '">' + dom.escape(category) + '</option>';
			}).join('');
		select.value = previous;
		if (select.value !== previous) {
			state.eventCategory = '';
			select.value = '';
		}
	}

	/** Event dropdown of the "Registered students" tab. */
	function renderEventFilterOptions() {
		const select = dom.$('#adminEventFilter');
		if (!select) {
			return;
		}
		const previous = state.studentEventId;
		const options = state.events.slice().sort(function (left, right) {
			return String(left.eventDate).localeCompare(String(right.eventDate));
		}).map(function (event) {
			return '<option value="' + event.id + '">' + dom.escape(event.name)
				+ ' \u2014 ' + dom.escape(fmt.dateMedium(event.eventDate)) + '</option>';
		}).join('');
		select.innerHTML = '<option value="">All events</option>' + options;
		select.value = previous;
		if (select.value !== previous) {
			state.studentEventId = '';
			select.value = '';
		}
	}

	function visibleEvents() {
		const query = state.eventSearch.trim().toLowerCase();
		const category = state.eventCategory.toLowerCase();
		return state.events.filter(function (event) {
			if (category && String(event.category || '').toLowerCase() !== category) {
				return false;
			}
			if (!query) {
				return true;
			}
			return [event.name, event.category, event.venue, event.description]
				.join(' ').toLowerCase().indexOf(query) !== -1;
		});
	}

	function renderEventTable() {
		const body = dom.$('#eventsTableBody');
		if (!body) {
			return;
		}
		const seats = seatsByEvent();
		const rows = visibleEvents();
		setText('#adminEventCount', fmt.plural(rows.length, 'event'));

		if (!rows.length) {
			body.innerHTML = state.events.length
				? messageRow(7, 'No event matches the current filters.',
					'Clear the search box or pick another category.')
				: messageRow(7, 'No events published yet.',
					'Use the "New event" button to add the first one.');
			return;
		}

		body.innerHTML = rows.map(function (event) {
			return eventRow(event, seats[String(event.id)] || 0);
		}).join('');
	}

	function eventRow(event, seats) {
		const upcoming = fmt.isUpcoming(event.eventDate, event.eventTime);
		return '<tr>'
			+ '<td>'
			+ '<div class="cc-row-title">' + dom.escape(event.name) + '</div>'
			+ '<div class="cc-row-sub cc-cell-clip">' + dom.escape(shorten(event.description, 88)) + '</div>'
			+ '</td>'
			+ '<td>' + fmt.categoryBadge(event.category) + '</td>'
			+ '<td>'
			+ '<div class="cc-row-title">' + dom.escape(fmt.dateMedium(event.eventDate)) + '</div>'
			+ '<div class="cc-row-sub">' + dom.escape(fmt.time(event.eventTime)) + ' &middot; '
			+ dom.escape(fmt.relativeToToday(event.eventDate)) + '</div>'
			+ '<div class="u-mt-1"><span class="cc-chip">' + (upcoming ? 'Upcoming' : 'Completed') + '</span></div>'
			+ '</td>'
			+ '<td><span class="cc-cell-clip" title="' + dom.escape(event.venue) + '">'
			+ dom.escape(event.venue) + '</span></td>'
			+ '<td><span class="cc-num">' + seats + '</span>'
			+ '<div class="cc-row-sub">' + dom.escape(fmt.plural(seats, 'student')) + '</div></td>'
			+ '<td>' + (event.featured
				? '<span class="cc-featured-flag">Spotlight</span>'
				: '<span class="cc-muted">\u2014</span>') + '</td>'
			+ '<td><div class="cc-table-actions">'
			+ '<button type="button" class="cc-btn cc-btn-outline cc-btn-sm" data-edit-event="'
			+ event.id + '">Edit</button>'
			+ '<button type="button" class="cc-btn cc-btn-danger cc-btn-sm" data-delete-event="'
			+ event.id + '">Delete</button>'
			+ '</div></td>'
			+ '</tr>';
	}

	function shorten(text, max) {
		const value = String(text || '');
		return value.length > max ? value.slice(0, max - 1).trim() + '\u2026' : value;
	}
	/* ------------------------ Registered students ---------------------- */
	function visibleRegistrations() {
		const query = state.studentSearch.trim().toLowerCase();
		const eventId = state.studentEventId;
		return state.registrations.filter(function (registration) {
			if (eventId && String(registration.eventId) !== String(eventId)) {
				return false;
			}
			if (!query) {
				return true;
			}
			return [registration.studentName, registration.email, registration.collegeOrYear,
				registration.phoneNumber, registration.eventName]
				.join(' ').toLowerCase().indexOf(query) !== -1;
		});
	}

	function renderStudentTable() {
		const body = dom.$('#studentsTableBody');
		if (!body) {
			return;
		}
		const rows = visibleRegistrations();
		setText('#adminStudentCount', fmt.plural(rows.length, 'student'));

		if (!rows.length) {
			body.innerHTML = state.registrations.length
				? messageRow(6, 'No registration matches the current filters.',
					'Reset the search box or choose another event.')
				: messageRow(6, 'No student has registered yet.',
					'Sign-ups appear here the moment the form is submitted.');
			return;
		}

		body.innerHTML = rows.map(studentRow).join('');
	}

	function studentRow(registration) {
		const schedule = registration.eventDate
			? fmt.dateMedium(registration.eventDate) + ' \u00B7 ' + fmt.time(registration.eventTime)
			: '';
		return '<tr>'
			+ '<td>'
			+ '<div class="u-flex u-center u-gap-3">'
			+ '<span class="cc-avatar" aria-hidden="true">'
			+ dom.escape(fmt.initials(registration.studentName)) + '</span>'
			+ '<div>'
			+ '<div class="cc-row-title">' + dom.escape(registration.studentName) + '</div>'
			+ '<div class="cc-row-sub">Registration #' + dom.escape(registration.id) + '</div>'
			+ '</div>'
			+ '</div>'
			+ '</td>'
			+ '<td><a class="cc-link" href="mailto:' + dom.escape(registration.email) + '">'
			+ dom.escape(registration.email) + '</a></td>'
			+ '<td>' + dom.escape(registration.collegeOrYear) + '</td>'
			+ '<td><span class="u-mono">' + dom.escape(registration.phoneNumber) + '</span></td>'
			+ '<td>'
			+ '<div class="cc-row-title">' + dom.escape(registration.eventName || 'Removed event') + '</div>'
			+ '<div class="cc-row-sub">'
			+ (registration.eventCategory ? fmt.categoryBadge(registration.eventCategory) + ' ' : '')
			+ dom.escape(schedule)
			+ '</div>'
			+ '</td>'
			+ '<td>' + dom.escape(fmt.dateTime(registration.registeredAt)) + '</td>'
			+ '</tr>';
	}

	/* ------------------------------- Tabs ------------------------------ */
	const PANELS = ['events-panel', 'students-panel'];

	function activateTab(panelId, updateHash) {
		const wanted = PANELS.indexOf(panelId) === -1 ? PANELS[0] : panelId;
		dom.$$('[data-tab]').forEach(function (tab) {
			const active = tab.getAttribute('data-tab') === wanted;
			tab.classList.toggle('is-active', active);
			tab.setAttribute('aria-selected', String(active));
			tab.setAttribute('aria-controls', tab.getAttribute('data-tab'));
			if (tab.getAttribute('role') === 'tab') {
				tab.setAttribute('tabindex', active ? '0' : '-1');
			}
		});
		PANELS.forEach(function (id) {
			const panel = dom.$('#' + id);
			if (panel) {
				(isActive(id) ? dom.show : dom.hide)(panel);
			}
		});
		if (updateHash) {
			window.history.replaceState(null, '', '#' + wanted);
		}

		function isActive(id) {
			return id === wanted;
		}
	}

	/** Left/right (and Home/End) keyboard navigation across the tablist. */
	function moveTabFocus(target, key) {
		const index = PANELS.indexOf(target.getAttribute('data-tab'));
		if (index === -1) {
			return;
		}
		let next = index;
		if (key === 'ArrowRight') {
			next = (index + 1) % PANELS.length;
		} else if (key === 'ArrowLeft') {
			next = (index - 1 + PANELS.length) % PANELS.length;
		} else if (key === 'Home') {
			next = 0;
		} else if (key === 'End') {
			next = PANELS.length - 1;
		}
		activateTab(PANELS[next], true);
		const nextTab = dom.$('[role="tab"][data-tab="' + PANELS[next] + '"]');
		if (nextTab) {
			nextTab.focus();
		}
	}
	/* --------------------------- Event form ---------------------------- */
	function renderCategoryOptions() {
		const select = dom.$('#evCategory');
		if (!select) {
			return;
		}
		const previous = select.value;
		select.innerHTML = categoryValues().map(function (category) {
			return '<option value="' + dom.escape(category) + '">' + dom.escape(category) + '</option>';
		}).join('')
			+ '<option value="' + CUSTOM_CATEGORY + '">Other (type it below)</option>';

		let known = false;
		for (let index = 0; index < select.options.length; index += 1) {
			if (select.options[index].value === previous) {
				known = true;
				break;
			}
		}
		select.value = known ? previous : select.options[0].value;
		toggleCustomCategory();
	}

	/** Reveals the free-text category box only while "Other" is selected. */
	function toggleCustomCategory() {
		const select = dom.$('#evCategory');
		const custom = dom.$('#evCategoryCustom');
		if (!select || !custom) {
			return;
		}
		const isCustom = select.value === CUSTOM_CATEGORY;
		custom.value = '';
		custom.required = isCustom;
		select.required = !isCustom;
		(isCustom ? dom.show : dom.hide)(custom);
	}

	function openCreateForm() {
		state.editingId = null;
		fillForm(null);
		setText('#eventModalTitle', 'Create a new event');
		setText('#eventModalHint', 'Published events appear on the student calendar instantly.');
		setText('#eventSubmit', 'Create event');
		setFieldValue('#evDate', todayInputValue());
		setFieldValue('#evTime', '18:00');
		modal.open('eventModal');
	}

	function openEditForm(id) {
		const event = findEvent(id);
		if (!event) {
			toast.error('That event is no longer in the calendar. Refresh the console.');
			return;
		}
		state.editingId = event.id;
		fillForm(event);
		setText('#eventModalTitle', 'Edit "' + shorten(event.name, 40) + '"');
		setText('#eventModalHint', 'Students see your changes as soon as you save.');
		setText('#eventSubmit', 'Save changes');
		modal.open('eventModal');
	}

	/** Populates the modal; pass null to reset it for a brand new event. */
	function fillForm(event) {
		const form = dom.$('#eventForm');
		if (form) {
			form.reset();
		}
		renderCategoryOptions();
		clearErrors();

		const select = dom.$('#evCategory');
		const custom = dom.$('#evCategoryCustom');
		setFieldValue('#evId', event ? event.id : '');
		setFieldValue('#evName', event ? event.name : '');
		setFieldValue('#evVenue', event ? event.venue : '');
		setFieldValue('#evDate', event ? (event.eventDate || '') : '');
		setFieldValue('#evTime', event ? fmt.timeInput(event.eventTime) : '');
		setFieldValue('#evDescription', event ? event.description : '');
		const featured = dom.$('#evFeatured');
		if (featured) {
			featured.checked = Boolean(event && event.featured);
		}
		if (!event || !select) {
			if (select) {
				select.selectedIndex = 0;
			}
			toggleCustomCategory();
			return;
		}

		const wanted = String(event.category || '').trim();
		for (let index = 0; index < select.options.length; index += 1) {
			if (select.options[index].value.toLowerCase() === wanted.toLowerCase()) {
				select.value = select.options[index].value;
				break;
			}
		}
		if (select.value !== wanted && wanted) {
			const option = document.createElement('option');
			option.value = wanted;
			option.textContent = wanted;
			select.insertBefore(option, select.lastElementChild);
			select.value = wanted;
		}
		if (custom) {
			custom.value = '';
		}
		toggleCustomCategory();
	}

	function setFieldValue(selector, value) {
		const node = dom.$(selector);
		if (node) {
			node.value = value === null || value === undefined ? '' : String(value);
		}
	}

	function todayInputValue() {
		const now = new Date();
		const month = now.getMonth() + 1;
		const day = now.getDate();
		return now.getFullYear() + '-' + (month < 10 ? '0' + month : month)
			+ '-' + (day < 10 ? '0' + day : day);
	}
	function readForm() {
		const select = dom.$('#evCategory');
		const useCustom = Boolean(select && select.value === CUSTOM_CATEGORY);
		return {
			name: fieldValue('#evName'),
			category: useCustom ? fieldValue('#evCategoryCustom') : (select ? select.value : ''),
			eventDate: fieldValue('#evDate'),
			eventTime: fieldValue('#evTime'),
			venue: fieldValue('#evVenue'),
			description: fieldValue('#evDescription'),
			featured: Boolean(dom.$('#evFeatured') && dom.$('#evFeatured').checked)
		};
	}

	function fieldValue(selector) {
		const node = dom.$(selector);
		return node ? String(node.value).trim() : '';
	}

	/** Same rules as the jakarta.validation annotations on the Event entity. */
	function validate(payload) {
		const errors = {};
		if (!payload.name) {
			errors.name = 'Event name is required';
		} else if (payload.name.length > LIMITS.name) {
			errors.name = 'Event name must be at most ' + LIMITS.name + ' characters';
		}
		if (!payload.category) {
			errors.category = 'Category is required';
		} else if (payload.category.length > LIMITS.category) {
			errors.category = 'Category must be at most ' + LIMITS.category + ' characters';
		}
		if (!payload.venue) {
			errors.venue = 'Venue is required';
		} else if (payload.venue.length > LIMITS.venue) {
			errors.venue = 'Venue must be at most ' + LIMITS.venue + ' characters';
		}
		if (!payload.eventDate) {
			errors.eventDate = 'Event date is required';
		}
		if (!payload.eventTime) {
			errors.eventTime = 'Event time is required';
		}
		if (!payload.description) {
			errors.description = 'Description is required';
		} else if (payload.description.length > LIMITS.description) {
			errors.description = 'Description must be at most ' + LIMITS.description + ' characters';
		}
		return errors;
	}

	/** Paints the server (or client) field errors exactly like the student form. */
	function setErrors(errors) {
		Object.keys(errors || {}).forEach(function (field) {
			const node = dom.$('[data-error-for="' + field + '"]');
			if (node) {
				node.textContent = errors[field];
				node.classList.add('is-visible');
			}
			const input = dom.$('#eventForm [name="' + field + '"]');
			if (input) {
				input.classList.add('is-invalid');
				input.setAttribute('aria-invalid', 'true');
			}
		});
	}

	function clearErrors() {
		dom.$$('#eventForm [data-error-for]').forEach(function (node) {
			node.textContent = '';
			node.classList.remove('is-visible');
		});
		dom.$$('#eventForm .is-invalid').forEach(function (input) {
			input.classList.remove('is-invalid');
			input.removeAttribute('aria-invalid');
		});
	}
	/* ---------------------------- Mutations ---------------------------- */
	async function submitEvent(event) {
		event.preventDefault();
		if (state.saving) {
			return;
		}
		const button = dom.$('#eventSubmit');
		const payload = readForm();
		clearErrors();

		const errors = validate(payload);
		if (Object.keys(errors).length) {
			setErrors(errors);
			toast.error('Please fix the highlighted fields.', 'Form not saved');
			const invalid = dom.$('#eventForm .is-invalid');
			if (invalid) {
				invalid.focus();
			}
			return;
		}

		const editingId = state.editingId;
		state.saving = true;
		ui.setLoading(button, true, editingId ? 'Saving\u2026' : 'Publishing\u2026');
		try {
			const saved = editingId
				? await api.put(ENDPOINTS.events + '/' + editingId, payload)
				: await api.post(ENDPOINTS.events, payload);
			const savedName = (saved && saved.name) || payload.name;
			state.editingId = null;
			modal.close('eventModal');
			toast.success(editingId ? 'Updated "' + savedName + '".' : 'Created "' + savedName + '".',
				editingId ? 'Event updated' : 'Event published');
			if (!fmt.isUpcoming(payload.eventDate, payload.eventTime)) {
				toast.info('The date is in the past, so students see it as completed.', 'Past event');
			}
			await reloadEvents();
		} catch (error) {
			if (error && error.fieldErrors) {
				setErrors(error.fieldErrors);
			}
			toast.fromError(error);
		} finally {
			state.saving = false;
			ui.setLoading(button, false);
		}
	}

	function openDeleteDialog(id) {
		const event = findEvent(id);
		if (!event) {
			toast.error('That event is no longer in the calendar. Refresh the console.');
			return;
		}
		state.pendingDelete = event.id;
		setText('#deleteEventName', event.name);
		modal.open('deleteModal');
	}

	async function confirmDelete() {
		if (!state.pendingDelete) {
			return;
		}
		const button = dom.$('#confirmDelete');
		const event = findEvent(state.pendingDelete);
		ui.setLoading(button, true, 'Deleting\u2026');
		try {
			await api.remove(ENDPOINTS.events + '/' + state.pendingDelete);
			state.pendingDelete = null;
			modal.close('deleteModal');
			toast.success('"' + ((event && event.name) || 'The event')
				+ '" and its student sign-ups were removed.', 'Event deleted');
			await Promise.all([reloadEvents(), reloadRegistrations()]);
		} catch (error) {
			toast.fromError(error);
		} finally {
			ui.setLoading(button, false);
		}
	}
	/* ------------------------------ Wiring ----------------------------- */
	function init() {
		ui.initChrome();

		const refresh = dom.$('#refreshAll');
		if (refresh) {
			refresh.addEventListener('click', async function () {
				ui.setLoading(refresh, true, 'Refreshing\u2026');
				await loadAll(true);
				ui.setLoading(refresh, false);
			});
		}

		const newEvent = dom.$('#newEvent');
		if (newEvent) {
			newEvent.addEventListener('click', openCreateForm);
		}

		dom.on(document, 'click', '[data-tab]', function (event, target) {
			event.preventDefault();
			activateTab(target.getAttribute('data-tab'), true);
		});

		dom.on(document, 'keydown', '[data-tab]', function (event, target) {
			if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(event.key) === -1) {
				return;
			}
			event.preventDefault();
			moveTabFocus(target, event.key);
		});

		dom.on(document, 'click', '[data-edit-event]', function (event, target) {
			event.preventDefault();
			openEditForm(target.getAttribute('data-edit-event'));
		});

		dom.on(document, 'click', '[data-delete-event]', function (event, target) {
			event.preventDefault();
			openDeleteDialog(target.getAttribute('data-delete-event'));
		});

		const categorySelect = dom.$('#evCategory');
		if (categorySelect) {
			categorySelect.addEventListener('change', toggleCustomCategory);
		}

		const form = dom.$('#eventForm');
		if (form) {
			form.addEventListener('submit', submitEvent);
		}

		const confirmButton = dom.$('#confirmDelete');
		if (confirmButton) {
			confirmButton.addEventListener('click', confirmDelete);
		}

		const eventSearch = dom.$('#adminEventSearch');
		if (eventSearch) {
			eventSearch.addEventListener('input', dom.debounce(function () {
				state.eventSearch = eventSearch.value.trim();
				renderEventTable();
			}, 250));
		}

		const categoryFilter = dom.$('#adminCategoryFilter');
		if (categoryFilter) {
			categoryFilter.addEventListener('change', function () {
				state.eventCategory = categoryFilter.value;
				renderEventTable();
			});
		}

		const studentSearch = dom.$('#adminStudentSearch');
		const eventFilter = dom.$('#adminEventFilter');
		if (studentSearch) {
			studentSearch.addEventListener('input', dom.debounce(function () {
				state.studentSearch = studentSearch.value.trim();
				renderStudentTable();
			}, 250));
		}
		if (eventFilter) {
			eventFilter.addEventListener('change', function () {
				state.studentEventId = eventFilter.value;
				renderStudentTable();
			});
		}

		const reset = dom.$('#resetStudents');
		if (reset) {
			reset.addEventListener('click', function () {
				state.studentSearch = '';
				state.studentEventId = '';
				if (studentSearch) {
					studentSearch.value = '';
				}
				if (eventFilter) {
					eventFilter.value = '';
				}
				renderStudentTable();
			});
		}

		const hash = (window.location.hash || '').replace('#', '');
		activateTab(PANELS.indexOf(hash) === -1 ? PANELS[0] : hash, false);

		loadAll(false);
	}

	// small hook so the console (or a future dashboard) can reuse the loaded state
	CC.admin = {
		state: state,
		reload: function () {
			return loadAll(false);
		},
		openCreateForm: openCreateForm,
		openEditForm: openEditForm,
		activateTab: activateTab
	};

	CC.boot(init);
})(window, document);
