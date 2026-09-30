# Campus CodeChef Chapter — Event Management

A full-stack web app for a college CodeChef chapter: students browse contests /
workshops, register with instant duplicate protection, and the core team manages
the calendar from an admin console. Spring Boot REST backend + vanilla
HTML/CSS/JS frontend, ready for a **hybrid deployment** (frontend on Vercel,
backend on Render or any Docker host).

## Features

| Area | What you get |
| --- | --- |
| Student site | Contest calendar with search, category pills, sorting, spotlight event with live countdown, seat counter, accessible registration modal with inline validation |
| Backend rules | One registration per email per event (HTTP **409**), bean validation (HTTP **400** with per-field messages), unknown event (HTTP **404**) — all rendered nicely in the UI |
| Admin console | Create / edit / delete events, promote the featured spotlight event, custom categories, students table with search + per-event filter |
| UX polish | Light/dark theme, responsive from 360 px up, skeleton loaders, toasts, keyboard-friendly dialogs |

## Tech stack

- **Backend:** Java 17, Spring Boot (Web MVC, Data JPA, Validation, Security), H2 in-memory DB (Postgres driver already on the classpath), Lombok, Maven wrapper
- **Frontend:** Static HTML/CSS/vanilla JS in `src/main/resources/static` — no build step, served by Spring Boot locally and by Vercel in production

## Project structure

```
CodeChefProject/
├── src/main/java/com/example/CodeChefProject/
│   ├── config/        SecurityConfig, WebConfig (global CORS), DataInitializer (seed data)
│   ├── controller/    EventController (/api/events), RegistrationController (/api/registrations)
│   ├── dto/ model/    Request/response DTOs and JPA entities
│   ├── exception/     GlobalExceptionHandler -> { status, message, path, fieldErrors }
│   ├── repository/ service/
│   └── CodeChefProjectApplication.java
├── src/main/resources/
│   ├── application.properties   # every value overridable via env vars
│   └── static/                  # index.html, admin.html, css/, js/ (core.js, app.js, admin.js)
├── Dockerfile         # multi-stage JDK 17 build -> alpine JRE runtime
├── vercel.json        # /api/:path* rewrite -> Render backend
└── pom.xml            # Java 17 — do not add/remove dependencies without updating the Dockerfile
```

## Run locally

Requires JDK 17+ (the Maven wrapper downloads Maven itself):

```bash
# Windows
mvnw.cmd spring-boot:run
# Linux / macOS
./mvnw spring-boot:run
```

- Student site: <http://localhost:8081/>
- Admin console: <http://localhost:8081/admin.html>
- H2 console: <http://localhost:8081/h2-console> (JDBC `jdbc:h2:mem:codechefclub`, user `sa`, empty password)

Build / verify without starting the server:

```bash
mvnw.cmd test-compile    # compile main + test sources
mvnw.cmd clean package -DskipTests
```

## Environment variables

Nothing is hardcoded — `application.properties` resolves every setting from env
vars with safe local defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `SERVER_PORT` | `8081` | Server port — `server.port=${PORT:${SERVER_PORT:8081}}`; Render injects `PORT` automatically |
| `DB_URL` | `jdbc:h2:mem:codechefclub;…` | Datasource URL (set to a Postgres JDBC URL in production) |
| `DB_USERNAME` / `DB_PASSWORD` | `sa` / *(empty)* | DB credentials — supply via the platform, never commit them |
| `DB_DRIVER` | `org.h2.Driver` | Set to `org.postgresql.Driver` with a Postgres URL |
| `JPA_DDL_AUTO` | `update` | Hibernate schema strategy |
| `H2_CONSOLE_ENABLED` | `true` | Turn **off** (`false`) in production |

## API summary

| Method & path | Used by | Notes |
| --- | --- | --- |
| `GET /api/events?search=&category=` | student grid | case-insensitive search + exact category |
| `GET /api/events/categories` | filter pills | `{ canonical: […], all: […], inUse: […] }` |
| `GET /api/events/featured` | spotlight banner | featured event or 404 |
| `GET /api/events/{id}` | modal lazy-load | single event |
| `POST/PUT/DELETE /api/events…` | admin console | create / edit / delete (delete cascades registrations) |
| `GET /api/registrations?search=&eventId=` | seat counter, admin tab | optional filters |
| `POST /api/registrations` | student modal | `201` created · `400` validation (`fieldErrors`) · `409` duplicate email+event |

All frontend calls use **relative** `/api/...` URLs (`ENDPOINTS` in
`js/core.js`), so they work unchanged through the Vercel rewrite below.


## Docker

The multi-stage `Dockerfile` matches `<java.version>17</java.version>`
(`maven:3.9.9-eclipse-temurin-17` build → `eclipse-temurin:17-jre-alpine`
runtime, non-root user):

```bash
docker build -t codechef-club-api .
docker run -p 8080:8080 -e PORT=8080 codechef-club-api
```

## Hybrid deployment (Vercel + Render)

```
Browser ──► Vercel (static frontend)
               └── vercel.json rewrite: /api/:path* ──► Render Spring Boot API
```

### 1. Backend on Render (Docker)

1. Push this repository to GitHub.
2. Render → **New → Web Service (Docker)**; Runtime: Docker, Render
   Release: `Dockerfile`.
3. Environment variables: `PORT` is set by Render automatically — leave the
   default. Add `DB_*` vars only if you attach a real Postgres. Set
   `H2_CONSOLE_ENABLED=false`.
4. Note the public URL, e.g. `https://codechef-club-api.onrender.com`.

### 2. Frontend on Vercel

1. Import the same repo (or a copy of `src/main/resources/static` pushed as its
   own repo).
2. Build settings: Framework **Other**, Build command *empty*, Output directory
   `src/main/resources/static` (the static folder is served as-is — no bundler).
3. `vercel.json` (repo root) proxies every API call to Render:

   ```json
   {
     "version": 2,
     "rewrites": [
       { "source": "/api/:path*",
         "destination": "https://YOUR-BACKEND-NAME.onrender.com/api/:path*" }
     ]
   }
   ```

   **Replace `YOUR-BACKEND-NAME` with your actual Render service name** before
   deploying. Because the rewrite is server-side, the browser only ever talks to
   the Vercel origin — no CORS issues in the browser, while the backend's global
   CORS config (`WebConfig.java`) still covers direct API access (mobile apps,
   curl, previews).

### 3. Smoke test after deploying

```bash
curl https://YOUR-FRONTEND.vercel.app/api/events        # via Vercel rewrite
curl https://YOUR-BACKEND-NAME.onrender.com/api/events  # direct backend
```

## Notes & known limitations

- The database is **in-memory H2**: data (and seeded samples) resets on every
  restart — attach Postgres via `DB_URL` for persistence.
- The admin console has **no login gate** by design (demo scope).
  `SecurityConfig` documents where to add authentication before real use.
- Data seeding (`DataInitializer`) runs on every boot; safe with the in-memory
  default, guard it if you point at a persistent database.
- CORS is intentionally open (`allowedOriginPatterns("*")`) for a public campus
  demo API; restrict it to your Vercel domain for production hardening.
