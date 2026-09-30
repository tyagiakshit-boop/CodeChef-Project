/* ==========================================================================
   core.js - shared runtime for the Campus CodeChef Chapter web app.
   Loaded by both index.html (student side) and admin.html (admin console).

   Provides, without any external dependency:
     CC.dom      tiny DOM query / escape / delegate helpers
     CC.theme    light-dark toggle persisted in localStorage
     CC.api      JSON fetch wrapper that understands the backend ApiError shape
     CC.toast    stacked notifications
     CC.fmt      date, time and text formatting helpers
     CC.modal    accessible modal open / close
     CC.countdown live countdown to a contest
     CC.ui       button loading state, nav wiring
   ========================================================================== */
(function (window, document) {
	'use strict';

	const THEME_KEY = 'cc-theme';
	const api = { base: '' };

	/* --------------------------- DOM helpers --------------------------- */
	const dom = {
		$(selector, scope) {
			return (scope || document).querySelector(selector);
		},
		$$(selector, scope) {
			return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
		},
		/** Escapes user supplied text before it is injected as HTML. */
		escape(value) {
			if (value === null || value === undefined) {
				return '';
			}
			return String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		},
		/** Event delegation: on(document, 'click', '[data-x]', handler). */
		on(root, type, selector, handler) {
			const scope = root || document;
			scope.addEventListener(type, function (event) {
				// event.target is not always an Element (text nodes, document,
				// programmatic events), so resolve the closest element first.
				const source = event.target;
				const start = source && typeof source.closest === 'function'
					? source
					: (source && source.parentElement) || null;
				const match = start ? start.closest(selector) : null;
				if (match && scope.contains(match)) {
					handler.call(match, event, match);
				}
			});
		},
		debounce(fn, wait) {
			let timer = null;
			return function () {
				const args = arguments;
				const context = this;
				window.clearTimeout(timer);
				timer = window.setTimeout(function () {
					fn.apply(context, args);
				}, wait || 250);
			};
		},
		show(node) {
			if (node) {
				node.classList.remove('u-hidden');
			}
		},
		hide(node) {
			if (node) {
				node.classList.add('u-hidden');
			}
		}
	};

	/* ----------------------------- Theming ----------------------------- */
	const theme = {
		preferred() {
			let stored = null;
			try {
				stored = window.localStorage.getItem(THEME_KEY);
			} catch (ignored) {
				stored = null;
			}
			if (stored === 'dark' || stored === 'light') {
				return stored;
			}
			return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
		},
		apply(mode) {
			const dark = mode === 'dark';
			document.documentElement.classList.toggle('dark', dark);
			document.documentElement.dataset.theme = dark ? 'dark' : 'light';
			const meta = document.querySelector('meta[name="color-scheme"]');
			if (meta) {
				meta.setAttribute('content', dark ? 'dark light' : 'light dark');
			}
			dom.$$('[data-theme-toggle]').forEach(function (button) {
				button.setAttribute('aria-pressed', String(dark));
				button.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
				const label = dom.$('[data-theme-label]', button);
				if (label) {
					label.textContent = dark ? 'Light' : 'Dark';
				}
			});
			dom.$$('[data-theme-icon]').forEach(function (icon) {
				icon.textContent = dark ? '\u2600' : '\u263D';
			});
		},
		current() {
			return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
		},
		set(mode) {
			try {
				window.localStorage.setItem(THEME_KEY, mode);
			} catch (ignored) {
				/* private browsing - keep the in-memory theme only */
			}
			theme.apply(mode);
		},
		toggle() {
			theme.set(theme.current() === 'dark' ? 'light' : 'dark');
		},
		init() {
			theme.apply(theme.preferred());
			dom.on(document, 'click', '[data-theme-toggle]', function (event) {
				event.preventDefault();
				theme.toggle();
			});
		}
	};
	// apply as early as possible so the page never flashes the wrong palette
	theme.apply(theme.preferred());
	/* ------------------------------- API ------------------------------- */
	function ApiError(message, status, fieldErrors, payload) {
		const error = new Error(message);
		error.name = 'ApiError';
		error.status = status || 0;
		error.fieldErrors = fieldErrors || null;
		error.payload = payload || null;
		return error;
	}

	async function request(url, options) {
		const opts = Object.assign({ headers: {} }, options || {});
		opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers);

		if (opts.body !== undefined && opts.body !== null && typeof opts.body !== 'string') {
			opts.headers['Content-Type'] = 'application/json';
			opts.body = JSON.stringify(opts.body);
		}

		let response;
		try {
			response = await window.fetch(api.base + url, opts);
		} catch (networkFailure) {
			throw ApiError('Cannot reach the server. Please check that the Spring Boot app is running.', 0, null, null);
		}

		if (response.status === 204) {
			return null;
		}

		const text = await response.text();
		let payload = null;
		if (text) {
			try {
				payload = JSON.parse(text);
			} catch (invalidJson) {
				payload = null;
			}
		}

		if (!response.ok) {
			const message = (payload && payload.message)
				|| 'Request failed with status ' + response.status + '.';
			throw ApiError(message, response.status, payload && payload.fieldErrors, payload);
		}
		return payload;
	}

	const apiClient = {
		get(path, params) {
			return request(path + query(params), { method: 'GET' });
		},
		post(path, body) {
			return request(path, { method: 'POST', body: body });
		},
		put(path, body) {
			return request(path, { method: 'PUT', body: body });
		},
		remove(path) {
			return request(path, { method: 'DELETE' });
		},
		/** Builds "?a=1&b=2", dropping empty values. */
		query: query,
		ApiError: ApiError
	};

	function query(params) {
		if (!params) {
			return '';
		}
		const parts = [];
		Object.keys(params).forEach(function (key) {
			const value = params[key];
			if (value === null || value === undefined || value === '') {
				return;
			}
			parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
		});
		return parts.length ? '?' + parts.join('&') : '';
	}

	/* ------------------------------ Toasts ----------------------------- */
	const TOAST_ICON = { success: '\u2714', error: '\u2716', warn: '\u26A0', info: '\u2139' };
	const TOAST_TITLE = { success: 'Success', error: 'Something went wrong', warn: 'Heads up', info: 'Info' };

	function toastContainer() {
		let wrap = dom.$('.cc-toast-wrap');
		if (!wrap) {
			wrap = document.createElement('div');
			wrap.className = 'cc-toast-wrap';
			wrap.setAttribute('role', 'status');
			wrap.setAttribute('aria-live', 'polite');
			document.body.appendChild(wrap);
		}
		return wrap;
	}

	const toast = {
		show(message, options) {
			const opts = Object.assign({ type: 'info', title: null, timeout: 4200 }, options || {});
			const node = document.createElement('div');
			node.className = 'cc-toast cc-toast-' + opts.type;
			node.innerHTML = ''
				+ '<span class="u-shrink0 mono" aria-hidden="true" style="font-size:1rem;line-height:1.2">'
				+ (TOAST_ICON[opts.type] || TOAST_ICON.info) + '</span>'
				+ '<span class="u-min0 u-grow">'
				+ '<span class="cc-toast-title">' + dom.escape(opts.title || TOAST_TITLE[opts.type] || 'Info') + '</span>'
				+ '<span class="cc-toast-msg">' + dom.escape(message) + '</span>'
				+ '</span>'
				+ '<button type="button" class="cc-icon-btn" style="width:26px;height:26px;border:0;background:transparent"'
				+ ' aria-label="Dismiss notification">&times;</button>';

			function dismiss() {
				node.classList.add('is-leaving');
				window.setTimeout(function () {
					node.remove();
				}, 240);
			}

			node.querySelector('button').addEventListener('click', dismiss);
			toastContainer().appendChild(node);
			if (opts.timeout > 0) {
				window.setTimeout(dismiss, opts.timeout);
			}
			return dismiss;
		},
		success(message, title) {
			return toast.show(message, { type: 'success', title: title });
		},
		error(message, title) {
			return toast.show(message, { type: 'error', title: title, timeout: 6000 });
		},
		warn(message, title) {
			return toast.show(message, { type: 'warn', title: title });
		},
		info(message, title) {
			return toast.show(message, { type: 'info', title: title });
		},
		/** Reports an ApiError nicely, including the per-field messages. */
		fromError(error) {
			if (error && error.fieldErrors) {
				const firstKey = Object.keys(error.fieldErrors)[0];
				if (firstKey) {
					return toast.error(error.fieldErrors[firstKey], 'Please check the form');
				}
			}
			return toast.error((error && error.message) || 'Unexpected error.');
		}
	};
	/* ---------------------------- Formatting --------------------------- */
	const CATEGORY_CLASS = {
		'rated contest': 'cc-badge-contest',
		'contest': 'cc-badge-contest',
		'dsa workshop': 'cc-badge-workshop',
		'workshop': 'cc-badge-workshop',
		'hackathon': 'cc-badge-hackathon',
		'icpc prep': 'cc-badge-icpc',
		'icpc': 'cc-badge-icpc',
		'tech talk': 'cc-badge-talk',
		'talk': 'cc-badge-talk'
	};

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	/** Parses "2026-10-12" into a local Date (never shifted by the timezone). */
	function parseDate(value) {
		if (!value) {
			return null;
		}
		const parts = String(value).split('-');
		if (parts.length !== 3) {
			return null;
		}
		const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		return isNaN(date.getTime()) ? null : date;
	}

	function parseTime(value) {
		if (!value) {
			return { hours: 0, minutes: 0, seconds: 0 };
		}
		const parts = String(value).split(':');
		return {
			hours: Number(parts[0]) || 0,
			minutes: Number(parts[1]) || 0,
			seconds: Number(parts[2]) || 0
		};
	}

	function pad(value) {
		return value < 10 ? '0' + value : String(value);
	}

	const fmt = {
		MONTHS: MONTHS,
		/** "2026-10-12" -> "Sun, 12 Oct 2026" */
		date(value) {
			const date = parseDate(value);
			if (!date) {
				return '\u2014';
			}
			return WEEKDAYS[date.getDay()] + ', ' + date.getDate() + ' ' + MONTHS[date.getMonth()]
				+ ' ' + date.getFullYear();
		},
		/** "2026-10-12" -> "12 Oct 2026" */
		dateMedium(value) {
			const date = parseDate(value);
			if (!date) {
				return '\u2014';
			}
			return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
		},
		/** "2026-10-12" -> "12 Oct" */
		dateShort(value) {
			const date = parseDate(value);
			if (!date) {
				return '\u2014';
			}
			return date.getDate() + ' ' + MONTHS[date.getMonth()];
		},
		/** "18:30:00" -> "6:30 PM" */
		time(value) {
			const parts = parseTime(value);
			const suffix = parts.hours >= 12 ? 'PM' : 'AM';
			let hour = parts.hours % 12;
			if (hour === 0) {
				hour = 12;
			}
			return hour + ':' + pad(parts.minutes) + ' ' + suffix;
		},
		/** "18:30:00" -> "18:30" (ISO, used for input[type=time]) */
		timeInput(value) {
			const parts = parseTime(value);
			return pad(parts.hours) + ':' + pad(parts.minutes);
		},
		/** "2026-09-29T15:20:11" -> "29 Sep 2026, 3:20 PM" */
		dateTime(value) {
			if (!value) {
				return '\u2014';
			}
			const raw = String(value).replace(' ', 'T');
			const date = new Date(raw);
			if (isNaN(date.getTime())) {
				return fmt.dateMedium(String(value).slice(0, 10));
			}
			return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear()
				+ ', ' + fmt.time(pad(date.getHours()) + ':' + pad(date.getMinutes()));
		},
		/** Friendly offset from today: "Today", "Tomorrow", "in 5 days", "3 days ago". */
		relativeToToday(dateValue) {
			const date = parseDate(dateValue);
			if (!date) {
				return '';
			}
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const days = Math.round((date.getTime() - today.getTime()) / 86400000);
			if (days === 0) {
				return 'Today';
			}
			if (days === 1) {
				return 'Tomorrow';
			}
			if (days === -1) {
				return 'Yesterday';
			}
			return days > 0 ? 'in ' + days + ' days' : Math.abs(days) + ' days ago';
		},
		/** True when the event start is still in the future. */
		isUpcoming(dateValue, timeValue) {
			const date = parseDate(dateValue);
			if (!date) {
				return false;
			}
			const parts = parseTime(timeValue);
			date.setHours(parts.hours, parts.minutes, parts.seconds, 0);
			return date.getTime() > Date.now();
		},
		isToday(dateValue) {
			const date = parseDate(dateValue);
			if (!date) {
				return false;
			}
			const today = new Date();
			return date.getDate() === today.getDate()
				&& date.getMonth() === today.getMonth()
				&& date.getFullYear() === today.getFullYear();
		},
		categoryClass(category) {
			return CATEGORY_CLASS[String(category || '').trim().toLowerCase()] || 'cc-badge-neutral';
		},
		categoryBadge(category) {
			return '<span class="cc-badge ' + fmt.categoryClass(category) + '">'
				+ dom.escape(category || 'Event') + '</span>';
		},
		/** Contest difficulty / level pill (1..7) mirroring CodeChef's star ratings. */
		starPill(level) {
			const value = Math.min(7, Math.max(1, Number(level) || 1));
			return '<span class="cc-star cc-star-' + value + '">' + value + '\u2605</span>';
		},
		initials(name) {
			const clean = String(name || '').trim();
			if (!clean) {
				return '?';
			}
			const words = clean.split(/\s+/);
			if (words.length === 1) {
				return words[0].slice(0, 2).toUpperCase();
			}
			return (words[0][0] + words[words.length - 1][0]).toUpperCase();
		},
		/** "01 Oct" style label used inside the event card date chip. */
		dayChip(dateValue) {
			const date = parseDate(dateValue);
			if (!date) {
				return { month: '\u2014', day: '--', weekday: '' };
			}
			return {
				month: MONTHS[date.getMonth()].toUpperCase(),
				day: pad(date.getDate()),
				weekday: WEEKDAYS[date.getDay()]
			};
		},
		plural(count, singular, pluralForm) {
			const value = Number(count) || 0;
			if (value === 1) {
				return value + ' ' + singular;
			}
			return value + ' ' + (pluralForm || singular + 's');
		}
	};
	/* ------------------------------ Modal ------------------------------ */
	let lastFocused = null;
	/** Ensures the document level modal listeners are attached only once. */
	let modalInitialized = false;

	const modal = {
		open(id) {
			const backdrop = typeof id === 'string' ? dom.$('#' + id) : id;
			if (!backdrop) {
				return;
			}
			lastFocused = document.activeElement;
			backdrop.classList.add('is-open');
			backdrop.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
			const focusable = backdrop.querySelector('[data-autofocus], input, select, textarea, button');
			if (focusable) {
				window.setTimeout(function () {
					focusable.focus();
				}, 30);
			}
		},
		close(id) {
			const backdrop = typeof id === 'string' ? dom.$('#' + id) : id;
			if (!backdrop) {
				return;
			}
			backdrop.classList.remove('is-open');
			backdrop.setAttribute('aria-hidden', 'true');
			if (!dom.$('.cc-modal-backdrop.is-open')) {
				document.body.style.overflow = '';
			}
			if (lastFocused && typeof lastFocused.focus === 'function') {
				lastFocused.focus();
			}
		},
		closeAll() {
			dom.$$('.cc-modal-backdrop.is-open').forEach(function (backdrop) {
				backdrop.classList.remove('is-open');
				backdrop.setAttribute('aria-hidden', 'true');
			});
			document.body.style.overflow = '';
		},
		isOpen(id) {
			const backdrop = typeof id === 'string' ? dom.$('#' + id) : id;
			return !!backdrop && backdrop.classList.contains('is-open');
		},
		init() {
			// Guarded: several pages (index.html, admin.html) call initChrome(),
			// and the document level listeners must only ever be attached once.
			if (modalInitialized) {
				return;
			}
			modalInitialized = true;

			dom.on(document, 'click', '[data-modal-open]', function (event, target) {
				event.preventDefault();
				const explicit = target.getAttribute('data-modal-open');
				const href = target.getAttribute('href');
				const id = explicit || (href ? href.slice(1) : null);
				modal.open(id);
			});
			dom.on(document, 'click', '[data-modal-close]', function (event, target) {
				event.preventDefault();
				modal.close(target.closest('.cc-modal-backdrop'));
			});
			// Backdrop click (delegated, so modals added later are covered too).
			document.addEventListener('click', function (event) {
				const backdrop = event.target && typeof event.target.closest === 'function'
					? event.target.closest('.cc-modal-backdrop')
					: null;
				if (backdrop && event.target === backdrop) {
					modal.close(backdrop);
				}
			});
			document.addEventListener('keydown', function (event) {
				if (event.key === 'Escape' || event.key === 'Esc') {
					const open = dom.$('.cc-modal-backdrop.is-open');
					if (open) {
						event.preventDefault();
						modal.close(open);
					}
				}
			});
		}
	};

	/* ---------------------------- Countdown ---------------------------- */
	/**
	 * Ticks once per second until the contest starts.
	 * @returns {Function} stop() clearing the timer (call when the node is removed).
	 */
	function countdown(dateValue, timeValue, onTick, onFinish) {
		const date = parseDate(dateValue);
		const clock = parseTime(timeValue);
		if (date) {
			date.setHours(clock.hours, clock.minutes, clock.seconds, 0);
		}
		const target = date ? date.getTime() : Date.now();
		let finished = false;

		function compute() {
			const diff = target - Date.now();
			const live = diff > 0;
			const total = live ? diff : 0;
			return {
				live: live,
				days: Math.floor(total / 86400000),
				hours: Math.floor((total % 86400000) / 3600000),
				minutes: Math.floor((total % 3600000) / 60000),
				seconds: Math.floor((total % 60000) / 1000)
			};
		}

		function tick() {
			const values = compute();
			if (onTick) {
				onTick(values);
			}
			if (!values.live && !finished) {
				finished = true;
				window.clearInterval(timer);
				if (onFinish) {
					onFinish(values);
				}
			}
		}

		tick();
		const timer = window.setInterval(tick, 1000);
		return function stop() {
			window.clearInterval(timer);
		};
	}
	/* -------------------------------- UI ------------------------------- */
	const ui = {
		/** Swaps a button into (and out of) its busy state. */
		setLoading(button, loading, busyLabel) {
			if (!button) {
				return;
			}
			if (loading) {
				if (!button.dataset.originalHtml) {
					button.dataset.originalHtml = button.innerHTML;
				}
				button.disabled = true;
				button.innerHTML = '<span class="cc-spin" aria-hidden="true"></span> '
					+ dom.escape(busyLabel || 'Working\u2026');
			} else {
				button.disabled = false;
				if (button.dataset.originalHtml) {
					button.innerHTML = button.dataset.originalHtml;
					delete button.dataset.originalHtml;
				}
			}
		},
		/** Mobile hamburger menu. */
		initNav() {
			const toggle = dom.$('[data-nav-toggle]');
			const menu = dom.$('[data-nav-menu]');
			if (!toggle || !menu) {
				return;
			}
			toggle.addEventListener('click', function () {
				const open = menu.classList.toggle('is-open');
				toggle.setAttribute('aria-expanded', String(open));
			});
			dom.on(menu, 'click', 'a', function () {
				menu.classList.remove('is-open');
				toggle.setAttribute('aria-expanded', 'false');
			});
		},
		/** Highlights the nav link matching the current page. */
		markActiveNav() {
			const page = window.location.pathname.split('/').pop() || 'index.html';
			dom.$$('[data-nav-link]').forEach(function (link) {
				const href = (link.getAttribute('href') || '').split('/').pop();
				link.classList.toggle('is-active', href === page);
			});
		},
		/** Smooth-scroll helper for in-page anchors. */
		scrollTo(selector) {
			const node = typeof selector === 'string' ? dom.$(selector) : selector;
			if (node) {
				node.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		},
		/** Renders N shimmering placeholder cards while data loads. */
		skeletonCards(container, count) {
			if (!container) {
				return;
			}
			let html = '';
			for (let index = 0; index < (count || 6); index += 1) {
				html += '<div class="cc-card cc-card-pad">'
					+ '<div class="cc-skeleton" style="height:14px;width:38%"></div>'
					+ '<div class="cc-skeleton u-mt-3" style="height:22px;width:82%"></div>'
					+ '<div class="cc-skeleton u-mt-3" style="height:12px;width:100%"></div>'
					+ '<div class="cc-skeleton u-mt-2" style="height:12px;width:72%"></div>'
					+ '<div class="cc-skeleton u-mt-5" style="height:36px;width:100%"></div>'
					+ '</div>';
			}
			container.innerHTML = html;
		},
		emptyState(title, hint) {
			return '<div class="cc-empty">'
				+ '<span class="mono" style="font-size:1.6rem">[ ]</span>'
				+ '<strong class="cc-soft">' + dom.escape(title) + '</strong>'
				+ '<span style="font-size:.85rem">' + dom.escape(hint || '') + '</span>'
				+ '</div>';
		},
		/** Wires the shared chrome (nav, modals, active link). Theme state is
		 *  applied by core.js itself so the toggle is never double-bound. */
		initChrome() {
			ui.initNav();
			ui.markActiveNav();
			modal.init();
		}
	};
	/* ------------------------------ Export ----------------------------- */
	const ENDPOINTS = {
		events: '/api/events',
		eventCategories: '/api/events/categories',
		featuredEvent: '/api/events/featured',
		registrations: '/api/registrations'
	};

	/** Runs the callback once the DOM is ready. */
	function boot(handler) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', handler);
		} else {
			handler();
		}
	}

	window.CC = {
		version: '1.0.0',
		dom: dom,
		theme: theme,
		api: apiClient,
		toast: toast,
		fmt: fmt,
		modal: modal,
		countdown: countdown,
		ui: ui,
		boot: boot,
		ENDPOINTS: ENDPOINTS
	};

	// Registered exactly once for every page that loads core.js.
	boot(function () {
		theme.init();
	});
})(window, document);
