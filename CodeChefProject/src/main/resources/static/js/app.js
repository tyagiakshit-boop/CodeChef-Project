/* ==========================================================================
   app.js - student facing page (index.html)
   Talks to the Spring Boot REST API:
     GET  /api/events?search=&category=   -> contest & event calendar
     GET  /api/events/categories          -> filter pills
     GET  /api/events/featured            -> spotlight contest
     GET  /api/registrations              -> seat counter
     POST /api/registrations              -> modal form
   ========================================================================== */
(function (window, document) {
	'use strict';

	const CC = window.CC;
	const api = CC.api;
	const dom = CC.dom;
	const fmt = CC.fmt;
	const toast = CC.toast;
	const ui = CC.ui;
	// core.js exposes the accessible modal helper; without this line app.js threw
	// "Uncaught ReferenceError: modal is not defined" as soon as a Register
	// button (event card, featured banner or empty state) was clicked.
	const modal = CC.modal;
	const ENDPOINTS = CC.ENDPOINTS;

	const ALL = 'All';

	/** id of the dialog declared in index.html (`<div id="registrationModal">`). */
	const MODAL_ID = 'registrationModal';

	const state = {
		/** Events currently rendered in the grid (already filtered by the API). */
		events: [],
		/** Unfiltered calendar, kept so filters never hide an event from the modal. */
		catalog: [],
		categories: [ALL],
		search: '',
		category: ALL,
		sort: 'date',
		selectedEventId: null,
		stopCountdown: null,
		submitting: false
	};

	/* ----------------------------- Loading ----------------------------- */
	async function loadEverything() {
		await Promise.all([loadCategories(), loadCatalog(), loadEvents(), loadFeatured(), loadSeatCount()]);
	}

	/**
	 * Loads the whole calendar once (no query parameters). It feeds the category
	 * pill counters, the home page stats and the registration modal's event
	 * picker, so a search / category filter never hides an event completely.
	 */
	async function loadCatalog() {
		try {
			state.catalog = (await api.get(ENDPOINTS.events)) || [];
		} catch (error) {
			// The grid request reports the failure to the user; keep the old cache.
			state.catalog = state.catalog || [];
		}
		renderCategoryPills();
	}

	async function loadCategories() {
		try {
			const payload = await api.get(ENDPOINTS.eventCategories);
			const list = (payload && payload.all) || [];
			state.categories = [ALL].concat(list);
		} catch (error) {
			// fallback so the pills still work when the categories endpoint is unavailable
			state.categories = [ALL, 'Rated Contest', 'DSA Workshop', 'Hackathon', 'ICPC Prep', 'Tech Talk'];
		}
		renderCategoryPills();
	}

	async function loadEvents() {
		const grid = dom.$('#eventGrid');
		ui.skeletonCards(grid, 6);
		try {
			state.events = (await api.get(ENDPOINTS.events, {
				search: state.search,
				category: state.category === ALL ? '' : state.category
			})) || [];
		} catch (error) {
			// The query failed: still filter the cached calendar locally so the
			// search box and category pills keep responding to the user.
			state.events = filterLocally();
			toast.fromError(error);
		}
		renderEvents();
		renderCategoryPills();
	}

	/**
	 * Client side mirror of {@code EventController.listEvents}: case-insensitive
	 * name search plus an exact (case-insensitive) category match.
	 */
	function filterLocally() {
		const keyword = state.search.trim().toLowerCase();
		const pool = state.catalog.length ? state.catalog : state.events;
		return pool.filter(function (event) {
			const matchesName = !keyword
				|| String(event.name).toLowerCase().indexOf(keyword) !== -1;
			const matchesCategory = state.category === ALL
				|| String(event.category).toLowerCase() === String(state.category).toLowerCase();
			return matchesName && matchesCategory;
		});
	}

	async function loadFeatured() {
		const holder = dom.$('#featuredSpotlight');
		const badge = dom.$('#featuredBadge');
		try {
			const featured = await api.get(ENDPOINTS.featuredEvent);
			state.featured = featured;
			if (badge) {
				badge.textContent = featured.category + ' \u00B7 ' + fmt.dateShort(featured.eventDate);
			}
			renderFeatured(featured);
		} catch (error) {
			state.featured = null;
			if (badge) {
				badge.textContent = 'Not scheduled';
			}
			if (holder) {
				holder.innerHTML = '<div class="cc-card">'
					+ ui.emptyState('No spotlight contest yet',
						'The core team has not marked a featured event. Check the calendar below.')
					+ '</div>';
			}
		}
	}

	/** Seat counter - the public API returns the list, only its size is shown. */
	async function loadSeatCount() {
		const node = dom.$('#statRegistrations');
		try {
			const registrations = await api.get(ENDPOINTS.registrations);
			if (node) {
				node.textContent = (registrations || []).length;
			}
		} catch (error) {
			if (node) {
				node.textContent = '0';
			}
		}
	}

	/* ------------------------------ Stats ------------------------------ */
	function renderStats() {
		const upcoming = state.events.filter(function (event) {
			return fmt.isUpcoming(event.eventDate, event.eventTime);
		}).length;
		const categories = {};
		state.events.forEach(function (event) {
			categories[String(event.category).toLowerCase()] = true;
		});

		setText('#statEvents', state.events.length);
		setText('#statUpcoming', upcoming);
		setText('#statCategories', Object.keys(categories).length);
	}

	function setText(selector, value) {
		const node = dom.$(selector);
		if (node) {
			node.textContent = String(value);
		}
	}

	/* --------------------------- Category pills ------------------------ */
	function renderCategoryPills() {
		const holder = dom.$('#categoryPills');
		if (!holder) {
			return;
		}
		holder.innerHTML = state.categories.map(function (category) {
			const active = category === state.category ? ' is-active' : '';
			const count = category === ALL
				? ''
				: ' <span class="mono" style="opacity:.7">' + countFor(category) + '</span>';
			return '<button type="button" class="cc-pill' + active + '" data-category="'
				+ dom.escape(category) + '" aria-pressed="' + (category === state.category) + '">'
				+ dom.escape(category) + count + '</button>';
		}).join('');
	}

	function countFor(category) {
		// Count on the unfiltered calendar so the pills keep showing how many
		// events exist per track even while a search / filter is active.
		const pool = state.catalog.length ? state.catalog : state.events;
		return pool.filter(function (event) {
			return String(event.category).toLowerCase() === String(category).toLowerCase();
		}).length;
	}
	/* ---------------------------- Event grid --------------------------- */
	function sortedEvents() {
		const list = state.events.slice();
		if (state.sort === 'name') {
			list.sort(function (a, b) {
				return a.name.localeCompare(b.name);
			});
		} else if (state.sort === 'category') {
			list.sort(function (a, b) {
				return String(a.category).localeCompare(String(b.category))
					|| String(a.eventDate).localeCompare(String(b.eventDate));
			});
		} else {
			list.sort(function (a, b) {
				return String(a.eventDate + a.eventTime).localeCompare(String(b.eventDate + b.eventTime));
			});
		}
		return list;
	}

	function renderEvents() {
		const grid = dom.$('#eventGrid');
		const counter = dom.$('#eventCount');
		if (counter) {
			counter.textContent = fmt.plural(state.events.length, 'event') + ' found';
		}
		renderStats();
		if (!grid) {
			return;
		}
		const list = sortedEvents();
		if (!list.length) {
			grid.style.display = 'block';
			grid.innerHTML = '<div class="cc-card">'
				+ ui.emptyState('No events match your filters',
					'Try a different keyword, or reset the search and category pills.')
				+ '<div class="u-flex u-jcenter u-mt-4">'
				+ '<button type="button" class="cc-btn cc-btn-primary" data-open-register>'
				+ 'Register for an upcoming contest</button>'
				+ '</div>'
				+ '</div>';
			return;
		}
		grid.style.display = '';
		// Re-rendering the grid is safe: the Register buttons are handled through
		// the delegated [data-register-event] listener wired in init().
		grid.innerHTML = list.map(eventCardHtml).join('');
	}

	/** Sequential contest code shown on every card, e.g. "CC-2026-004". */
	function eventCode(event) {
		const year = String(event.eventDate || '').slice(0, 4) || String(new Date().getFullYear());
		const serial = String(event.id || 0).padStart(3, '0');
		return 'CC-' + year + '-' + serial;
	}

	function eventCardHtml(event) {
		const chip = fmt.dayChip(event.eventDate);
		const upcoming = fmt.isUpcoming(event.eventDate, event.eventTime);
		const action = upcoming
			? '<button type="button" class="cc-btn cc-btn-primary" data-register-event="' + event.id + '">'
				+ 'Register</button>'
			: '<button type="button" class="cc-btn cc-btn-outline" disabled title="This event has already taken place">'
				+ 'Registration closed</button>';

		return '<article class="cc-card cc-card-hover cc-fade-up" data-event-card="' + event.id + '">'
			+ '<div class="cc-card-pad u-flex u-col" style="height:100%">'

			+ '<div class="u-flex u-between u-aitems-start u-gap-3">'
			+ '<div class="u-text-center u-shrink0" style="min-width:58px;padding:.4rem .3rem;border-radius:12px;'
			+ 'background:var(--cc-surface-2);border:1px solid var(--cc-border)">'
			+ '<div class="cc-stat-label" style="font-size:.6rem;letter-spacing:.06em">' + chip.month + '</div>'
			+ '<div class="mono" style="font-size:1.2rem;font-weight:700;line-height:1.15">' + chip.day + '</div>'
			+ '<div class="cc-muted" style="font-size:.62rem">' + chip.weekday + '</div>'
			+ '</div>'
			+ '<div class="u-flex u-col u-gap-2 u-aitems-end u-min0">'
			+ fmt.categoryBadge(event.category)
			+ '<span class="cc-event-code">' + dom.escape(eventCode(event)) + '</span>'
			+ '</div>'
			+ '</div>'

			+ '<h3 class="u-mt-4" style="font-size:1.05rem;line-height:1.4">'
			+ (event.featured ? '<span class="cc-gold-text" title="Featured event">\u2605 </span>' : '')
			+ dom.escape(event.name) + '</h3>'

			+ '<p class="cc-soft u-mt-2 u-clamp-3" style="font-size:.855rem;line-height:1.65">'
			+ dom.escape(event.description) + '</p>'

			+ '<div class="u-grid u-gap-2 u-mt-4" style="font-size:.8rem">'
			+ metaRow('Date', fmt.time(event.eventTime) + ' \u00B7 ' + fmt.dateMedium(event.eventDate))
			+ metaRow('Venue', event.venue)
			+ metaRow('When', fmt.relativeToToday(event.eventDate))
			+ '</div>'

			+ '<div class="u-flex u-between u-center u-gap-3 u-mt-5 u-ml-auto u-w-full" '
			+ 'style="margin-top:auto;padding-top:1.1rem">'
			+ '<span class="cc-chip">' + (upcoming ? 'Seats open' : 'Completed') + '</span>'
			+ action
			+ '</div>'

			+ '</div></article>';
	}

	function metaRow(label, text) {
		return '<div class="u-flex u-center u-gap-2 u-min0">'
			+ '<span class="cc-stat-label" style="font-size:.6rem;min-width:46px">' + label + '</span>'
			+ '<span class="cc-soft u-clamp-2">' + dom.escape(text) + '</span>'
			+ '</div>';
	}

	/* -------------------------- Featured banner ------------------------ */
	function renderFeatured(event) {
		const holder = dom.$('#featuredSpotlight');
		if (!holder) {
			return;
		}
		holder.innerHTML = '<div class="cc-featured-banner">'
			+ '<div class="u-split u-center u-gap-5" style="position:relative;z-index:1">'
			+ '<div class="u-min0">'
			+ '<span class="cc-featured-flag">\u2605 Spotlight contest</span>'
			+ '<h3 class="u-mt-4" style="font-size:clamp(1.35rem,3vw,2.05rem);line-height:1.25;color:#F8F2EB">'
			+ dom.escape(event.name) + '</h3>'
			+ '<div class="u-flex u-wrap u-center u-gap-3 u-mt-3" style="font-size:.83rem;color:rgba(248,242,235,.82)">'
			+ '<span>' + fmt.date(event.eventDate) + '</span>'
			+ '<span aria-hidden="true">&bull;</span>'
			+ '<span>' + fmt.time(event.eventTime) + '</span>'
			+ '<span aria-hidden="true">&bull;</span>'
			+ '<span>' + dom.escape(event.venue) + '</span>'
			+ '</div>'
			+ '<p class="u-mt-4 u-clamp-3" style="max-width:58ch;font-size:.92rem;line-height:1.75;'
			+ 'color:rgba(248,242,235,.8)">' + dom.escape(event.description) + '</p>'
			+ '<div class="u-flex u-wrap u-center u-gap-3 u-mt-5">'
			+ '<button type="button" class="cc-btn cc-btn-primary" data-register-event="' + event.id + '">'
			+ 'Register for this contest</button>'
			+ '<a class="cc-btn cc-btn-outline cc-glass" href="#events">Browse calendar</a>'
			+ '</div>'
			+ '</div>'

			+ '<div class="u-flex u-col u-center u-gap-4">'
			+ '<span class="cc-countdown-label">Contest begins in</span>'
			+ '<div class="u-flex u-wrap u-center u-gap-3 cc-countdown">'
			+ countdownCell('days', 'Days') + countdownCell('hours', 'Hours')
			+ countdownCell('minutes', 'Minutes') + countdownCell('seconds', 'Seconds')
			+ '</div>'
			+ '<span class="cc-chip cc-glass" style="border-color:rgba(217,119,6,.45);color:#FBE3B8">'
			+ dom.escape(event.category) + ' \u00B7 ' + dom.escape(eventCode(event)) + '</span>'
			+ '</div>'

			+ '</div></div>';

		startCountdown(event);
	}

	function countdownCell(key, label) {
		return '<span class="u-flex u-col u-center cc-countdown-box">'
			+ '<span class="cc-countdown-value mono" data-cd="' + key + '">--</span>'
			+ '<span class="cc-countdown-label">' + label + '</span></span>';
	}

	function startCountdown(event) {
		if (state.stopCountdown) {
			state.stopCountdown();
			state.stopCountdown = null;
		}
		if (!fmt.isUpcoming(event.eventDate, event.eventTime)) {
			setCountdownText({ days: 0, hours: 0, minutes: 0, seconds: 0 });
			return;
		}
		state.stopCountdown = CC.countdown(event.eventDate, event.eventTime, function (parts) {
			setCountdownText(parts);
		});
	}

	function setCountdownText(parts) {
		Object.keys(parts).forEach(function (key) {
			const node = dom.$('[data-cd="' + key + '"]');
			if (node) {
				node.textContent = String(parts[key]).padStart(2, '0');
			}
		});
	}
	/* -------------------------- Registration --------------------------- */
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const PHONE_RE = /^[0-9+][0-9 ()-]{7,19}$/;

	/** The registration dialog declared in index.html (`#registrationModal`). */
	function registrationDialog() {
		return document.getElementById(MODAL_ID);
	}

	/**
	 * Opens the registration modal for one event. Used by every Register button
	 * (event card, featured banner, empty state) - the dialog is resolved from
	 * the DOM, which fixes the old "modal is not defined" crash.
	 *
	 * @param {string|number|null} eventId preselected event id
	 */
	function openRegisterForm(eventId) {
		clearErrors();
		hideFormAlert();
		fillEventSelect(eventId);
		const dialog = registrationDialog();
		if (!dialog) {
			toast.error('The registration dialog is missing from the page.');
			return;
		}
		modal.open(dialog);
	}

	/** Closes the dialog (used by the submit handler and the Escape / backdrop). */
	function closeRegisterForm() {
		hideFormAlert();
		clearErrors();
		state.selectedEventId = null;
		modal.close(MODAL_ID);
	}

	/** Upcoming events first, already finished ones last. */
	function selectableEvents() {
		const pool = (state.catalog.length ? state.catalog : state.events).slice();
		if (state.featured && !containsEvent(pool, state.featured.id)) {
			pool.push(state.featured);
		}
		const upcoming = [];
		const past = [];
		pool.forEach(function (event) {
			(fmt.isUpcoming(event.eventDate, event.eventTime) ? upcoming : past).push(event);
		});
		return upcoming.concat(past);
	}

	function containsEvent(list, id) {
		return list.some(function (event) {
			return String(event.id) === String(id);
		});
	}

	/** Looks an event up in the featured banner, the catalog and the grid. */
	function findEvent(id) {
		if (id === null || id === undefined || id === '') {
			return null;
		}
		const candidates = [state.featured].concat(state.catalog, state.events);
		for (let index = 0; index < candidates.length; index += 1) {
			if (candidates[index] && String(candidates[index].id) === String(id)) {
				return candidates[index];
			}
		}
		return null;
	}

	/**
	 * Fills the "Contest / event" select with the calendar and preselects the
	 * clicked event. The event is always present, even when a search or category
	 * filter hid it from the grid; unknown ids are fetched from the API.
	 */
	function fillEventSelect(selectedId) {
		const select = dom.$('#regEvent');
		if (!select) {
			return;
		}
		state.selectedEventId = (selectedId === null || selectedId === undefined || selectedId === '')
			? null
			: String(selectedId);

		const applyOptions = function () {
			const list = selectableEvents();
			if (state.selectedEventId && !containsEvent(list, state.selectedEventId)) {
				select.innerHTML = '<option value="">Loading events&hellip;</option>';
				return api.get(ENDPOINTS.events + '/' + encodeURIComponent(state.selectedEventId))
					.then(function (event) {
						list.unshift(event);
						renderEventOptions(select, list, state.selectedEventId);
					})
					.catch(function () {
						renderEventOptions(select, list, null);
					});
			}
			renderEventOptions(select, list, state.selectedEventId);
			return null;
		};

		if (state.catalog.length || state.events.length) {
			applyOptions();
			return;
		}
		select.innerHTML = '<option value="">Loading events&hellip;</option>';
		api.get(ENDPOINTS.events).then(function (list) {
			state.catalog = list || [];
			applyOptions();
		}).catch(function (error) {
			select.innerHTML = '<option value="">Could not load events</option>';
			toast.fromError(error);
		});
	}

	function renderEventOptions(select, list, selectedId) {
		if (!list.length) {
			select.innerHTML = '<option value="">No events scheduled yet</option>';
			updateEventSummary(null);
			return;
		}
		select.innerHTML = '<option value="">Choose a contest or event&hellip;</option>'
			+ list.map(function (event) {
				const open = fmt.isUpcoming(event.eventDate, event.eventTime);
				const chosen = selectedId && String(event.id) === String(selectedId);
				return '<option value="' + dom.escape(String(event.id)) + '"'
					+ (chosen ? ' selected' : '') + '>'
					+ dom.escape(event.name) + ' \u2014 ' + dom.escape(fmt.dateMedium(event.eventDate))
					+ (open ? '' : ' (closed)') + '</option>';
			}).join('');
		if (selectedId) {
			select.value = String(selectedId);
		}
		updateEventSummary(findEvent(select.value) || findEvent(selectedId));
	}

	/** Prints the selected Event Name (plus schedule) right under the picker. */
	function updateEventSummary(event) {
		const node = dom.$('#regEventSummary');
		if (!node) {
			return;
		}
		if (!event) {
			node.textContent = '';
			node.classList.add('u-hidden');
			return;
		}
		node.textContent = 'Selected event: ' + event.name + ' \u00B7 ' + fmt.dateMedium(event.eventDate)
			+ ' \u00B7 ' + fmt.time(event.eventTime) + ' \u00B7 ' + event.venue;
		node.classList.remove('u-hidden');
	}

	/** Banner inside the modal, used for backend errors (409 duplicate, 400, ...). */
	function showFormAlert(message) {
		const node = dom.$('#registrationError');
		if (!node) {
			return;
		}
		node.textContent = message || 'Registration failed. Please try again.';
		node.classList.remove('u-hidden');
	}

	function hideFormAlert() {
		const node = dom.$('#registrationError');
		if (node) {
			node.textContent = '';
			node.classList.add('u-hidden');
		}
	}

	function readForm() {
		const form = dom.$('#registrationForm');
		const data = {};
		if (!form) {
			return data;
		}
		Array.prototype.forEach.call(form.elements, function (field) {
			if (field.name) {
				data[field.name] = String(field.value || '').trim();
			}
		});
		return data;
	}

	/** Mirrors the jakarta.validation rules declared on RegistrationRequest. */
	function validate(data) {
		const errors = {};
		if (!data.eventId) {
			errors.eventId = 'Please pick a contest or event to register for';
		}
		if (!data.studentName) {
			errors.studentName = 'Student name is required';
		} else if (data.studentName.length > 120) {
			errors.studentName = 'Student name must be at most 120 characters';
		}
		if (!data.email) {
			errors.email = 'Email is required';
		} else if (!EMAIL_RE.test(data.email)) {
			errors.email = 'Enter a valid email address (e.g. coder@college.edu)';
		}
		if (!data.collegeOrYear) {
			errors.collegeOrYear = 'College / Year is required';
		} else if (data.collegeOrYear.length > 120) {
			errors.collegeOrYear = 'College / Year must be at most 120 characters';
		}
		if (!data.phoneNumber) {
			errors.phoneNumber = 'Phone number is required';
		} else if (!PHONE_RE.test(data.phoneNumber)) {
			errors.phoneNumber = 'Enter a valid phone number (8-20 digits, may include +, spaces, - or ())';
		}
		return errors;
	}
	function showFieldErrors(errors) {
		clearErrors();
		const keys = Object.keys(errors || {});
		keys.forEach(function (field) {
			const node = dom.$('[data-error-for="' + field + '"]');
			if (node) {
				node.textContent = errors[field];
				node.classList.add('is-visible');
			}
			const input = dom.$('[name="' + field + '"]');
			if (input) {
				input.classList.add('is-invalid');
				input.setAttribute('aria-invalid', 'true');
			}
		});
		if (keys.length) {
			const first = dom.$('[name="' + keys[0] + '"]');
			if (first && typeof first.focus === 'function') {
				first.focus();
			}
		}
		return keys.length;
	}

	function clearErrors() {
		dom.$$('[data-error-for]').forEach(function (node) {
			node.textContent = '';
			node.classList.remove('is-visible');
		});
		dom.$$('#registrationForm .is-invalid').forEach(function (input) {
			input.classList.remove('is-invalid');
			input.removeAttribute('aria-invalid');
		});
	}

	async function submitRegistration(event) {
		event.preventDefault();
		if (state.submitting) {
			return;
		}
		const button = dom.$('#registrationSubmit');
		const data = readForm();
		hideFormAlert();
		if (showFieldErrors(validate(data))) {
			toast.warn('Please fix the highlighted fields before submitting.');
			return;
		}

		state.submitting = true;
		ui.setLoading(button, true, 'Registering\u2026');
		try {
			const created = await api.post(ENDPOINTS.registrations, {
				eventId: Number(data.eventId),
				studentName: data.studentName,
				email: data.email,
				collegeOrYear: data.collegeOrYear,
				phoneNumber: data.phoneNumber
			});
			resetRegistrationForm();
			closeRegisterForm();
			toast.success('You are registered for "' + (created.eventName || 'the event') + '" on '
				+ fmt.dateMedium(created.eventDate) + ' at ' + fmt.time(created.eventTime) + '.',
				'Registration confirmed');
			loadSeatCount();
		} catch (error) {
			if (error.fieldErrors) {
				showFieldErrors(error.fieldErrors);
			}
			// Keep the modal open and explain the problem right where the user is
			// looking (duplicate registration -> HTTP 409, validation -> HTTP 400).
			showFormAlert(error.message);
			toast.fromError(error);
		} finally {
			state.submitting = false;
			ui.setLoading(button, false);
		}
	}

	/** Clears every field, inline error and the selected event summary. */
	function resetRegistrationForm() {
		const form = dom.$('#registrationForm');
		if (form) {
			form.reset();
		}
		clearErrors();
		hideFormAlert();
		state.selectedEventId = null;
		updateEventSummary(null);
	}
	/* ------------------------------ Wiring ----------------------------- */
	function refreshEvents() {
		return loadEvents();
	}

	function init() {
		ui.initChrome();

		const year = dom.$('#footerYear');
		if (year) {
			year.textContent = String(new Date().getFullYear());
		}

		// --- Search events by name -> GET /api/events?search=... -------------
		const search = dom.$('#eventSearch');
		if (search) {
			const runSearch = dom.debounce(function () {
				state.search = search.value.trim();
				refreshEvents();
			}, 250);
			search.addEventListener('input', runSearch);
			// the native "clear" (x) button of input[type=search] fires no input event
			search.addEventListener('search', function () {
				state.search = search.value.trim();
				refreshEvents();
			});
		}

		// --- Sort dropdown (client side, no request needed) ------------------
		const sort = dom.$('#eventSort');
		if (sort) {
			sort.addEventListener('change', function () {
				state.sort = sort.value;
				renderEvents();
			});
		}

		const reset = dom.$('#clearFilters');
		if (reset) {
			reset.addEventListener('click', function () {
				state.search = '';
				state.category = ALL;
				state.sort = 'date';
				if (search) {
					search.value = '';
				}
				if (sort) {
					sort.value = 'date';
				}
				refreshEvents();
			});
		}

		// --- Category pills -> GET /api/events?category=... ------------------
		// Delegated on the document, so the pills created by renderCategoryPills()
		// keep working after every re-render.
		dom.on(document, 'click', '[data-category]', function (event, target) {
			event.preventDefault();
			const chosen = target.getAttribute('data-category');
			state.category = state.category === chosen ? ALL : chosen;
			refreshEvents();
		});

		// --- Register buttons (grid cards, spotlight banner, empty state) ----
		// Delegation on the document keeps the buttons of freshly rendered
		// / filtered event cards working without re-binding anything.
		dom.on(document, 'click', '[data-register-event]', function (event, target) {
			event.preventDefault();
			openRegisterForm(target.getAttribute('data-register-event'));
		});

		dom.on(document, 'click', '[data-open-register]', function (event) {
			event.preventDefault();
			openRegisterForm(null);
		});

		// --- Registration modal form ----------------------------------------
		const eventSelect = dom.$('#regEvent');
		if (eventSelect) {
			eventSelect.addEventListener('change', function () {
				state.selectedEventId = eventSelect.value || null;
				clearErrors();
				hideFormAlert();
				updateEventSummary(findEvent(eventSelect.value));
			});
		}

		const form = dom.$('#registrationForm');
		if (form) {
			form.addEventListener('submit', submitRegistration);
		}

		loadEverything();
	}

	// small hook so the console (or future pages) can reuse the loaded state
	CC.app = {
		state: state,
		reload: refreshEvents,
		openRegisterForm: openRegisterForm,
		closeRegisterForm: closeRegisterForm
	};

	CC.boot(init);
})(window, document);
