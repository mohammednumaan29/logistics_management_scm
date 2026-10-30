package com.disruptioniq.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.response.DashboardSummaryResponse;
import com.disruptioniq.service.DashboardService;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private static final int DEFAULT_ACTIVITY_LIMIT = 10;
    private static final int MAX_ACTIVITY_LIMIT = 50;

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /**
     * Returns the main operational dashboard summary.
     */
    @GetMapping("/summary")
    public DashboardSummaryResponse getDashboardSummary(
            @RequestParam(defaultValue = "10") int activityLimit) {

        int safeLimit = normalizeLimit(activityLimit);

        return dashboardService.getSummary(safeLimit);
    }

    /**
     * Returns recent recovery progress updates.
     */
    @GetMapping("/recovery-activity")
    public List<DashboardSummaryResponse.RecentRecoveryActivity>
            getRecentRecoveryActivity(
                    @RequestParam(defaultValue = "10") int limit) {

        return dashboardService.getRecentRecoveryActivity(
                normalizeLimit(limit));
    }

    private int normalizeLimit(int requestedLimit) {

        if (requestedLimit <= 0) {
            return DEFAULT_ACTIVITY_LIMIT;
        }

        return Math.min(requestedLimit, MAX_ACTIVITY_LIMIT);
    }
}