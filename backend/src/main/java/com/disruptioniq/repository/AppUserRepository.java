
package com.disruptioniq.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.neo4j.repository.Neo4jRepository;

import com.disruptioniq.model.AppUser;

public interface AppUserRepository
        extends Neo4jRepository<AppUser, String> {

    Optional<AppUser> findByUsername(String username);

    List<AppUser> findByRoleInAndEnabledTrue(List<String> roles);

    boolean existsByUsername(String username);

    boolean existsByRole(String role);
}
