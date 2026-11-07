package com.picsou.controller;

import com.picsou.dto.DashboardResponse;
import com.picsou.dto.MoversResponse;
import com.picsou.service.DashboardMoversService;
import com.picsou.service.DashboardService;
import com.picsou.service.UserContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final DashboardMoversService moversService;
    private final UserContext userContext;

    public DashboardController(DashboardService dashboardService, DashboardMoversService moversService,
                               UserContext userContext) {
        this.dashboardService = dashboardService;
        this.moversService = moversService;
        this.userContext = userContext;
    }

    @GetMapping
    public DashboardResponse getDashboard(@RequestParam(required = false) String range) {
        return dashboardService.getDashboard(userContext.currentMemberId(), range);
    }

    /** Day-over-day movers of the held securities; {@code limit} is clamped to 1..10 per list. */
    @GetMapping("/movers")
    public MoversResponse movers(@RequestParam(defaultValue = "5") int limit) {
        return moversService.movers(userContext.currentMemberId(), LocalDate.now(), limit);
    }
}
