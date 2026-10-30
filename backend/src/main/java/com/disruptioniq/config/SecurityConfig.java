
package com.disruptioniq.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private static final String[] ALL_ROLES = {
        "ROLE_OPERATIONS_ANALYST",
        "ROLE_SUPPLY_CHAIN_MANAGER",
        "ROLE_WAREHOUSE_OPERATOR",
        "ROLE_PROCUREMENT_APPROVER",
        "ROLE_ADMIN"
    };

    private static final String[] PLAN_CREATORS = {
        "ROLE_OPERATIONS_ANALYST",
        "ROLE_SUPPLY_CHAIN_MANAGER",
        "ROLE_ADMIN"
    };

    private static final String[] PLAN_DECIDERS = {
        "ROLE_PROCUREMENT_APPROVER",
        "ROLE_SUPPLY_CHAIN_MANAGER",
        "ROLE_ADMIN"
    };

    private static final String[] RECOVERY_PLANNERS = {
        "ROLE_OPERATIONS_ANALYST",
        "ROLE_SUPPLY_CHAIN_MANAGER",
        "ROLE_ADMIN"
    };

    private static final String[] OPERATIONAL_RESOURCES = {
        "/api/shipments",
        "/api/shipments/**",
        "/api/suppliers",
        "/api/suppliers/**",
        "/api/warehouses",
        "/api/warehouses/**",
        "/api/inventory",
        "/api/inventory/**",
        "/api/products",
        "/api/products/**",
        "/api/customers",
        "/api/customers/**",
        "/api/orders",
        "/api/orders/**",
        "/api/impact",
        "/api/impact/**",
        "/api/risk",
        "/api/risk/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http
            // Use the single CORS bean defined in CorsConfig.java.
            .cors(Customizer.withDefaults())

            .csrf(AbstractHttpConfigurer::disable)

            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )

            .formLogin(AbstractHttpConfigurer::disable)

            .httpBasic(AbstractHttpConfigurer::disable)

            .authorizeHttpRequests(authorize -> authorize

                // CORS PREFLIGHT
                .requestMatchers(
                    HttpMethod.OPTIONS,
                    "/**"
                ).permitAll()

                // AUTHENTICATION
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/auth/login"
                ).permitAll()

                // CARRIER WEBHOOK
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/webhooks/carrier"
                ).permitAll()

                // HEALTH CHECKS
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/health",
                    "/actuator/health"
                ).permitAll()

                // DATA IMPORT
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/import/**"
                ).hasAnyAuthority(
                    "ROLE_OPERATIONS_ANALYST",
                    "ROLE_SUPPLY_CHAIN_MANAGER",
                    "ROLE_ADMIN"
                )

                // RECOVERY PROGRESS
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery-progress/**"
                ).hasAnyAuthority(
                    "ROLE_WAREHOUSE_OPERATOR",
                    "ROLE_SUPPLY_CHAIN_MANAGER",
                    "ROLE_ADMIN"
                )

                .requestMatchers(
                    HttpMethod.GET,
                    "/api/recovery-progress/**"
                ).hasAnyAuthority(ALL_ROLES)

                // RECOVERY SIMULATION
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/simulation"
                ).hasAnyAuthority(RECOVERY_PLANNERS)

                // RECOVERY FEASIBILITY
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery/feasibility"
                ).hasAnyAuthority(RECOVERY_PLANNERS)

                // NOTIFICATIONS
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/notifications",
                    "/api/notifications/**"
                ).hasAnyAuthority(ALL_ROLES)

                .requestMatchers(
                    HttpMethod.PATCH,
                    "/api/notifications/**"
                ).hasAnyAuthority(ALL_ROLES)

                // AUDIT
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/audit/entities/**"
                ).hasAnyAuthority(
                    "ROLE_SUPPLY_CHAIN_MANAGER",
                    "ROLE_ADMIN"
                )

                .requestMatchers(
                    HttpMethod.GET,
                    "/api/audit/**"
                ).hasAnyAuthority(ALL_ROLES)

                // RECOVERY PLAN EXECUTION
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery-plans/*/execute"
                ).hasAnyAuthority(
                    "ROLE_SUPPLY_CHAIN_MANAGER",
                    "ROLE_ADMIN"
                )

                // RECOVERY PLAN CREATION
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery-plans"
                ).hasAnyAuthority(PLAN_CREATORS)

                // RECOVERY PLAN APPROVAL
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery-plans/*/approve"
                ).hasAnyAuthority(PLAN_DECIDERS)

                // RECOVERY PLAN REJECTION
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/recovery-plans/*/reject"
                ).hasAnyAuthority(PLAN_DECIDERS)

                // RECOVERY PLAN READ ACCESS
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/recovery-plans",
                    "/api/recovery-plans/**"
                ).hasAnyAuthority(ALL_ROLES)

                .requestMatchers(
                    "/api/recovery-plans",
                    "/api/recovery-plans/**"
                ).denyAll()

                // OPERATIONAL DATA READ ACCESS
                .requestMatchers(
                    HttpMethod.GET,
                    OPERATIONAL_RESOURCES
                ).hasAnyAuthority(ALL_ROLES)

                // PREVENT DIRECT WRITES THROUGH THESE RESOURCES
                .requestMatchers(
                    OPERATIONAL_RESOURCES
                ).denyAll()

                // DASHBOARD
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/dashboard/**"
                ).hasAnyAuthority(ALL_ROLES)

                // AI HEALTH
                .requestMatchers(
                    "/api/ai/health"
                ).hasAuthority("ROLE_ADMIN")

                // AI SERVICE
                .requestMatchers(
                    "/api/ai/**"
                ).hasAnyAuthority(ALL_ROLES)

                // DEFAULT SECURITY
                .anyRequest().authenticated()
            )

            // JWT RESOURCE SERVER
            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt ->
                    jwt.jwtAuthenticationConverter(
                        jwtAuthenticationConverter()
                    )
                )
            );

        return http.build();
    }

    // JWT ROLE CONVERSION
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {

        JwtGrantedAuthoritiesConverter authoritiesConverter =
            new JwtGrantedAuthoritiesConverter();

        authoritiesConverter.setAuthoritiesClaimName("roles");
        authoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter converter =
            new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter(
            authoritiesConverter
        );

        return converter;
    }
}
