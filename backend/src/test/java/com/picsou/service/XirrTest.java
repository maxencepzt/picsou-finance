package com.picsou.service;

import com.picsou.service.Xirr.CashFlow;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class XirrTest {

    @Test
    void matchesExcelsDocumentedExample() {
        // Microsoft's XIRR reference example, documented result 0.373362535.
        Double rate = Xirr.solve(List.of(
            new CashFlow(LocalDate.of(2008, 1, 1), -10000),
            new CashFlow(LocalDate.of(2008, 3, 1), 2750),
            new CashFlow(LocalDate.of(2008, 10, 30), 4250),
            new CashFlow(LocalDate.of(2009, 2, 15), 3250),
            new CashFlow(LocalDate.of(2009, 4, 1), 2750)));

        assertThat(rate).isCloseTo(0.373362535, within(1e-8));
    }

    @Test
    void solvesALoss() {
        Double rate = Xirr.solve(List.of(
            new CashFlow(LocalDate.of(2025, 1, 1), -1000),
            new CashFlow(LocalDate.of(2026, 1, 1), 800)));

        assertThat(rate).isCloseTo(-0.2, within(1e-8));
    }

    @Test
    void flowsOfOneSignHaveNoRoot() {
        assertThat(Xirr.solve(List.of(
            new CashFlow(LocalDate.of(2025, 1, 1), -1000),
            new CashFlow(LocalDate.of(2026, 1, 1), -500)))).isNull();
        assertThat(Xirr.solve(List.of())).isNull();
    }
}
