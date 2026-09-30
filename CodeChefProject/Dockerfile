# =============================================================================
# Campus CodeChef Chapter - Event Management (Spring Boot backend)
# Multi-stage build. JDK 17 matches <java.version>17</java.version> in pom.xml.
#
#   docker build -t codechef-club-api .
#   docker run -p 8080:8080 -e PORT=8080 codechef-club-api
#
# Render: point the Docker runtime at this file; Render injects $PORT and the
# image honours it through server.port=${PORT:${SERVER_PORT:8081}}.
# =============================================================================

# ------------------------------ Build stage ------------------------------
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build

# Cache dependencies first so code-only changes reuse the Maven layer.
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline

COPY src ./src
RUN mvn -q -B clean package -DskipTests

# ----------------------------- Runtime stage -----------------------------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Non-root user (Alpine ships with adduser/addgroup in busybox).
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

COPY --from=build /build/target/*.jar app.jar

EXPOSE 9090

ENTRYPOINT ["java", "-jar", "app.jar"]
