package com.disruptioniq.dto.response;

import java.util.List;

public record ImportResponse(
        String entityType,
        int totalRows,
        int importedRows,
        int rejectedRows,
        List<String> errors
) {
}