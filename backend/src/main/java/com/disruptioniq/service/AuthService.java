
package com.disruptioniq.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.disruptioniq.dto.request.LoginRequest;
import com.disruptioniq.dto.response.LoginResponse;
import com.disruptioniq.model.AppUser;
import com.disruptioniq.repository.AppUserRepository;

@Service
public class AuthService {

    private static final long TOKEN_LIFETIME_SECONDS = 1800;

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public AuthService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder) {

        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {

        String username = request.username().trim();

        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException(
                        "Invalid username or password."));

        if (!user.isEnabled()) {
            throw new DisabledException("This account is disabled.");
        }

        if (!passwordEncoder.matches(
                request.password(),
                user.getPasswordHash())) {

            throw new BadCredentialsException(
                    "Invalid username or password.");
        }

        String role = normalizeRole(user.getRole());

        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(TOKEN_LIFETIME_SECONDS);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("disruptioniq")
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(user.getId())
                .claim("userId", user.getId())
                .claim("username", user.getUsername())
                .claim("roles", List.of("ROLE_" + role))
                .build();

        JwsHeader header = JwsHeader
                .with(MacAlgorithm.HS256)
                .build();

        String token = jwtEncoder.encode(
                JwtEncoderParameters.from(header, claims))
                .getTokenValue();

        return new LoginResponse(
                token,
                "Bearer",
                TOKEN_LIFETIME_SECONDS,
                user.getId(),
                user.getUsername(),
                role
        );
    }

    private String normalizeRole(String role) {

        if (role == null || role.isBlank()) {
            throw new IllegalStateException(
                    "The user account has no assigned role.");
        }

        String normalized = role.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');

        return switch (normalized) {
            case "OPERATIONS_ANALYST",
                 "SUPPLY_CHAIN_MANAGER",
                 "WAREHOUSE_OPERATOR",
                 "PROCUREMENT_APPROVER",
                 "ADMIN" -> normalized;

            default -> throw new IllegalStateException(
                    "The user account has an unsupported role.");
        };
    }
}
