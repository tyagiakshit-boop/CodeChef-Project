package com.example.CodeChefProject.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * spring-boot-starter-security is on the classpath, so without this configuration
 * every page and API call would be redirected to the generated login form.
 * <p>
 * The campus chapter demo is intentionally open: the student site and the admin
 * console both talk to the JSON API without a session. CSRF is disabled for the
 * stateless API, and the H2 console is excluded from the filter chain entirely so
 * its frame based UI keeps working.
 * <p>
 * For a real deployment lock this down by re-enabling authentication here and
 * protecting the {@code /api/events} POST/PUT/DELETE endpoints (e.g. HTTP Basic
 * with a chapter-admin role).
 */
@Configuration
public class SecurityConfig {

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/h2-console/**").permitAll()
						.anyRequest().permitAll())
				.csrf(AbstractHttpConfigurer::disable)
				.headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin))
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable);
		return http.build();
	}
}
