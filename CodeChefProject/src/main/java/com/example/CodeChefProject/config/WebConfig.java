package com.example.CodeChefProject.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Global CORS configuration for the hybrid deployment (static frontend on
 * Vercel proxying {@code /api/...} to this backend on Render / Docker).
 * <p>
 * {@code allowedOriginPatterns("*")} (instead of {@code allowedOrigins("*")})
 * is used on purpose: it also matches credentialed requests and any future
 * preview URLs. Requests are mapped for every path ({@code /**}) and explicitly
 * for {@code /api/**}, so both the JSON API and any other cross-origin asset
 * keep working regardless of which origin serves the pages.
 * <p>
 * This complements the Spring Security setup in {@link SecurityConfig} (every
 * route is {@code permitAll}, so preflight {@code OPTIONS} requests reach the
 * MVC layer where these mappings are applied) and the {@code @CrossOrigin}
 * annotations kept on the controllers as documentation of the public API.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**")
				.allowedOriginPatterns("*")
				.allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
				.allowedHeaders("*");
		registry.addMapping("/api/**")
				.allowedOriginPatterns("*")
				.allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
				.allowedHeaders("*");
	}
}