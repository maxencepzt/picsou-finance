package com.picsou.service;

import com.picsou.adapter.OpenFigiIsinConverter;
import com.picsou.port.SidecarErrorCode;
import com.picsou.exception.SyncException;
import com.picsou.model.Account;
import com.picsou.model.AccountHolding;
import com.picsou.repository.AccountHoldingRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.picsou.service.SyncValues.clean;
import static com.picsou.service.SyncValues.limit;
import static com.picsou.service.SyncValues.sumComplete;
import static com.picsou.service.SyncValues.weightedAverage;

/**
 * Turns the positions a brokerage sidecar returns into the holdings of an account.
 *
 * <p>The rules are the ones {@code BourseDirectSyncService} applies to its own positions: an ISIN
 * resolves to a ticker, two lines resolving to the same ticker merge into one, a quote needs its
 * currency, and anything unreadable refuses the whole account ({@code INVALID_DATA}) rather than
 * dropping a line. Written for the CIC connector's securities portfolios; the older brokerage
 * services still carry their own copy.
 */
@Component
public class BrokeragePositions {

    private final OpenFigiIsinConverter isinConverter;
    private final SecurityIdentityService identityService;
    private final AccountHoldingRepository holdingRepository;

    public BrokeragePositions(OpenFigiIsinConverter isinConverter, SecurityIdentityService identityService,
                              AccountHoldingRepository holdingRepository) {
        this.isinConverter = isinConverter;
        this.identityService = identityService;
        this.holdingRepository = holdingRepository;
    }

    /** One line as a sidecar returns it. */
    public record Raw(String isin, String symbol, String label, BigDecimal quantity, BigDecimal buyingPriceEur,
                      BigDecimal currentPrice, String quoteCurrency, BigDecimal currentValueEur, BigDecimal pnlEur) {}

    /** One line ready to store, keyed by its resolved ticker. */
    public record Prepared(String ticker, String name, BigDecimal quantity, BigDecimal averageBuyInEur,
                           BigDecimal currentPrice, String quoteCurrency, BigDecimal currentValueEur,
                           BigDecimal pnlEur) {}

    /**
     * Validates and resolves the lines of one account. Network (OpenFIGI) and database work:
     * call it before the transaction that stores the account.
     *
     * @param bank the bank's name, for the error messages
     */
    public List<Prepared> prepare(List<Raw> rawPositions, String bank) {
        Map<String, Prepared> positions = new LinkedHashMap<>();
        Map<String, String> isinByTicker = new LinkedHashMap<>();
        for (Raw position : rawPositions) {
            if (position == null || position.quantity() == null || position.currentValueEur() == null) {
                throw invalid(bank + " returned an incomplete position");
            }
            if (position.quantity().signum() == 0) {
                continue;
            }
            String currency = currency(position.quoteCurrency(), bank);
            if (position.currentPrice() != null && currency == null) {
                throw invalid(bank + " returned a quote without its currency");
            }
            String ticker = resolveTicker(position, isinByTicker, bank);
            positions.merge(ticker, new Prepared(ticker, limit(position.label(), 100, ticker), position.quantity(),
                position.buyingPriceEur(), position.currentPrice(), currency, position.currentValueEur(),
                position.pnlEur()), (left, right) -> merge(left, right, bank));
        }
        identityService.record(isinByTicker);
        return positions.values().stream().filter(position -> position.quantity().signum() != 0).toList();
    }

    /**
     * What the account cost: its cash plus each line's cost basis (unit cost × quantity, else value
     * minus latent gain). One line with neither makes the basis unknowable: the balance stands in,
     * so the account shows no gain rather than an invented one.
     */
    public BigDecimal investedAmount(BigDecimal cashBalance, BigDecimal balanceEur, List<Prepared> positions) {
        BigDecimal invested = cashBalance;
        for (Prepared position : positions) {
            BigDecimal costBasis = null;
            if (position.averageBuyInEur() != null) {
                costBasis = position.averageBuyInEur().multiply(position.quantity());
            } else if (position.pnlEur() != null) {
                costBasis = position.currentValueEur().subtract(position.pnlEur());
            }
            if (costBasis == null) {
                return balanceEur;
            }
            invested = invested.add(costBasis);
        }
        return invested;
    }

    /** Replaces the account's holdings with these lines, so a line sold since the last sync goes. */
    public void replaceHoldings(Account account, List<Prepared> positions, Instant syncedAt) {
        holdingRepository.deleteByAccountId(account.getId());
        holdingRepository.flush();
        holdingRepository.saveAll(positions.stream()
            .map(position -> AccountHolding.builder()
                .account(account)
                .ticker(position.ticker())
                .name(position.name())
                .quantity(position.quantity())
                .averageBuyIn(position.averageBuyInEur())
                .currentPrice(position.currentPrice())
                .quoteCurrency(position.quoteCurrency())
                .providerValueEur(position.currentValueEur())
                .providerPnlEur(position.pnlEur())
                .lastSyncedAt(syncedAt)
                .build())
            .toList());
        holdingRepository.flush();
    }

    private String resolveTicker(Raw position, Map<String, String> isinByTicker, String bank) {
        String ticker = clean(position.symbol());
        String isin = isin(position.isin(), bank);
        if (isin != null) {
            OpenFigiIsinConverter.TickerResult resolved = isinConverter.resolve(isin);
            if (resolved != null && resolved.ticker() != null && !resolved.ticker().isBlank()) {
                ticker = resolved.ticker().trim();
            }
        }
        if ((ticker == null || ticker.length() > 30) && isin != null) {
            ticker = isin;
        }
        if (ticker == null || ticker.length() > 30) {
            throw invalid(bank + " returned an invalid instrument identifier");
        }
        if (isin != null) {
            isinByTicker.put(ticker, isin);
        }
        return ticker;
    }

    private static String isin(String raw, String bank) {
        String isin = clean(raw);
        if (isin == null) {
            return null;
        }
        isin = isin.toUpperCase(Locale.ROOT);
        if (!isin.matches("[A-Z]{2}[A-Z0-9]{10}")) {
            throw invalid(bank + " returned an invalid ISIN");
        }
        return isin;
    }

    private static String currency(String raw, String bank) {
        String currency = clean(raw);
        if (currency == null) {
            return null;
        }
        currency = currency.toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw invalid(bank + " returned an invalid quote currency");
        }
        return currency;
    }

    private static Prepared merge(Prepared left, Prepared right, String bank) {
        if (!Objects.equals(left.quoteCurrency(), right.quoteCurrency())) {
            throw invalid(bank + " returned conflicting quote currencies");
        }
        BigDecimal quantity = left.quantity().add(right.quantity());
        return new Prepared(
            left.ticker(),
            right.name() != null ? right.name() : left.name(),
            quantity,
            weightedAverage(left.averageBuyInEur(), left.quantity(), right.averageBuyInEur(), right.quantity(), quantity),
            weightedAverage(left.currentPrice(), left.quantity(), right.currentPrice(), right.quantity(), quantity),
            left.quoteCurrency(),
            left.currentValueEur().add(right.currentValueEur()),
            sumComplete(left.pnlEur(), right.pnlEur()));
    }

    private static SyncException invalid(String message) {
        return new SyncException(message, null, SidecarErrorCode.INVALID_DATA.name());
    }
}
