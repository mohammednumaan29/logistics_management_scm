
package com.disruptioniq.dto.response;

public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String userId,
        String username,
        String role
) {
}
