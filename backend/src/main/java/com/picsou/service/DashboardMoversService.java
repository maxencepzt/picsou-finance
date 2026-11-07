package com.picsou.service;

import com.picsou.dto.HoldingLogoUrls;
import com.picsou.dto.MoversResponse;
import com.picsou.dto.MoversResponse.Mover;
import com.picsou.model.Account;
import com.picsou.model.AccountHolding;
import com.picsou.model.AccountType;
import com.picsou.model.PriceSnapshot;
import com.picsou.repository.AccountHoldingRepository;
import com.picsou.repository.PriceSnapshotRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The dashboard's "movers": how much each held security moved between its two most recent
 * {@code price_snapshot} days. Reads only stored prices and stored logos, never a provider.
 */
@Service
@Transactional(readOnly = true)
public class DashboardMoversService {

    static final int MIN_LIMIT = 1;
    static final int MAX_LIMIT = 10;
    // shortcut: a fixed 10-day lookback, so a ticker no longer priced drops out instead of showing
    // a month-old move; widen it if instances that sleep for weeks need movers on wake-up.
    static final int LOOKBACK_DAYS = 10;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final AccountAccessResolver access;
    private final AccountHoldingRepository holdings;
    private final PriceSnapshotRepository snapshots;
    private final InstrumentLogoService logos;

    public DashboardMoversService(
        AccountAccessResolver access,
        AccountHoldingRepository holdings,
        PriceSnapshotRepository snapshots,
        InstrumentLogoService logos
    ) {
        this.access = access;
        this.holdings = holdings;
        this.snapshots = snapshots;
        this.logos = logos;
    }

    public MoversResponse movers(Long memberId, LocalDate today, int limit) {
        int max = Math.clamp(limit, MIN_LIMIT, MAX_LIMIT);
        // Same perimeter as the dashboard (readable, not hidden), restricted to the account types
        // that hold positions. EMPLOYEE_SAVINGS holds lines without being isInvestment().
        List<Account> accounts = access.readableAccounts(memberId).stream()
            .filter(a -> !a.isHidden() && a.getType() != null
                && (a.getType().isInvestment() || a.getType() == AccountType.EMPLOYEE_SAVINGS))
            .toList();
        if (accounts.isEmpty()) {
            return new MoversResponse(null, null, List.of(), List.of());
        }
        Map<Long, BigDecimal> shares = access.sharesFor(accounts, memberId);

        Map<String, Position> positions = new LinkedHashMap<>();
        for (AccountHolding h : holdings.findPositiveByAccountIdIn(accounts.stream().map(Account::getId).toList())) {
            if (h.getTicker() == null || h.getTicker().isBlank() || h.getAccount() == null) {
                continue;
            }
            BigDecimal quantity = AccountAccessResolver.weigh(h.getQuantity(), shares.get(h.getAccount().getId()));
            positions.computeIfAbsent(h.getTicker().trim().toUpperCase(Locale.ROOT), Position::new)
                .add(quantity, h.getName(), h.getAccount().getType() == AccountType.CRYPTO);
        }
        positions.values().removeIf(p -> p.quantity.signum() <= 0);
        if (positions.isEmpty()) {
            return new MoversResponse(null, null, List.of(), List.of());
        }

        // Newest first per ticker, so the first two rows of a ticker are its latest two days.
        Map<String, List<PriceSnapshot>> byTicker = new LinkedHashMap<>();
        for (PriceSnapshot s : snapshots.findRecentByTickers(positions.keySet(), today.minusDays(LOOKBACK_DAYS), today)) {
            byTicker.computeIfAbsent(s.getTicker().toUpperCase(Locale.ROOT), k -> new ArrayList<>()).add(s);
        }
        Set<String> shareTickers = new HashSet<>();
        positions.values().stream().filter(p -> !p.crypto).forEach(p -> shareTickers.add(p.ticker));
        // Crypto marks come from CoinGecko over the network; stored marks are shares and funds only.
        Map<String, HoldingLogoUrls> marks = shareTickers.isEmpty() ? Map.of() : logos.storedUrls(shareTickers);

        LocalDate date = null;
        LocalDate previousDate = null;
        List<Mover> gainers = new ArrayList<>();
        List<Mover> losers = new ArrayList<>();
        for (Position p : positions.values()) {
            List<PriceSnapshot> rows = byTicker.getOrDefault(p.ticker, List.of());
            if (rows.size() < 2 || rows.get(1).getPriceEur().signum() <= 0) {
                continue;
            }
            PriceSnapshot latest = rows.get(0);
            PriceSnapshot previous = rows.get(1);
            date = date == null || latest.getDate().isAfter(date) ? latest.getDate() : date;
            previousDate = previousDate == null || previous.getDate().isAfter(previousDate)
                ? previous.getDate() : previousDate;

            BigDecimal price = latest.getPriceEur();
            BigDecimal before = previous.getPriceEur();
            BigDecimal change = price.subtract(before).multiply(HUNDRED).divide(before, 2, RoundingMode.HALF_UP);
            HoldingLogoUrls mark = p.crypto ? null : marks.get(p.ticker);
            Mover mover = new Mover(
                p.ticker,
                p.name != null ? p.name : p.ticker,
                mark == null ? null : mark.light(),
                price,
                before,
                change,
                p.quantity.multiply(price).setScale(2, RoundingMode.HALF_UP),
                p.quantity.multiply(price.subtract(before)).setScale(2, RoundingMode.HALF_UP));
            if (change.signum() > 0) {
                gainers.add(mover);
            } else if (change.signum() < 0) {
                losers.add(mover);
            }
        }
        Comparator<Mover> tieBreak = Comparator.comparing(Mover::ticker);
        gainers.sort(Comparator.comparing(Mover::changePercent).reversed().thenComparing(tieBreak));
        losers.sort(Comparator.comparing(Mover::changePercent).thenComparing(tieBreak));
        return new MoversResponse(date, previousDate,
            List.copyOf(gainers.subList(0, Math.min(max, gainers.size()))),
            List.copyOf(losers.subList(0, Math.min(max, losers.size()))));
    }

    /** One ticker merged across accounts: summed (share-weighted) quantity, first name seen. */
    private static final class Position {
        private final String ticker;
        private BigDecimal quantity = BigDecimal.ZERO;
        private String name;
        private boolean crypto = true;

        Position(String ticker) {
            this.ticker = ticker;
        }

        void add(BigDecimal qty, String holdingName, boolean onCryptoAccount) {
            quantity = quantity.add(qty);
            if (name == null && holdingName != null && !holdingName.isBlank()) {
                name = holdingName;
            }
            // A ticker held on any non-crypto account is a share or a fund and may have a stored mark.
            crypto = crypto && onCryptoAccount;
        }
    }
}
