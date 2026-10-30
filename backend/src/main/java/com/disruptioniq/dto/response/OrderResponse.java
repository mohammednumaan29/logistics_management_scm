
package com.disruptioniq.dto.response;

import java.time.LocalDate;

public record OrderResponse(
        String id,
        String priority,
        long quantity,
        LocalDate promisedDelivery,
        String status
) {
}
