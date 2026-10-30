
package com.disruptioniq.dto.response;

public record ProductResponse(
        String id,
        String name,
        String category,
        double unitCost
) {
}
