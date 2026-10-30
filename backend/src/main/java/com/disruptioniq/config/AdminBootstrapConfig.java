
package com.disruptioniq.config;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;

import com.disruptioniq.model.AppUser;
import com.disruptioniq.repository.AppUserRepository;

@Configuration
public class AdminBootstrapConfig {

    @Bean
    @ConditionalOnProperty(
            name = "app.security.bootstrap-admin.enabled",
            havingValue = "true")
    public ApplicationRunner bootstrapAdmin(
            AppUserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.security.bootstrap-admin.username:}")
            String username,
            @Value("${app.security.bootstrap-admin.password:}")
            String password) {

        return args -> {
            String adminUsername =
                    username == null ? "" : username.trim();

            if (!StringUtils.hasText(adminUsername)) {
                throw new IllegalStateException(
                        "Admin bootstrap username is required.");
            }

            if (password == null || password.length() < 12) {
                throw new IllegalStateException(
                        "Admin bootstrap password must be at least 12 characters.");
            }

            // Never create a second administrator automatically.
            if (userRepository.existsByRole("ADMIN")) {
                System.out.println(
                        "Admin bootstrap skipped: an ADMIN account already exists.");
                return;
            }

            // Never promote an existing non-admin account.
            if (userRepository.existsByUsername(adminUsername)) {
                throw new IllegalStateException(
                        "The bootstrap username already exists. "
                        + "Use a different username or configure the existing "
                        + "administrator through a controlled administrative process.");
            }

            AppUser admin = new AppUser(
                    "USR-" + UUID.randomUUID(),
                    adminUsername,
                    passwordEncoder.encode(password),
                    "ADMIN",
                    true
            );

            userRepository.save(admin);

            System.out.println(
                    "Initial administrator created successfully.");
        };
    }
}
