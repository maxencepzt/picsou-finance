package com.picsou.dto;

import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.CardNature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record AccountResponse(
    Long id,
    String name,
    AccountType type,
    String provider,
    String currency,
    BigDecimal currentBalance,
    BigDecimal currentBalanceEur,
    BigDecimal cashBalance,
    Instant lastSyncedAt,
    boolean isManual,
    String color,
    String ticker,
    String logoUrl,
    String logoKey,
    Instant createdAt,
    /** When the member says the wrapper was opened; null unless they have stated it. */
    LocalDate openedAt,
    RealEstateMetadataResponse realEstate,
    DebtResponse debt,
    SavingsConfigDto savingsConfig,
    BigDecimal paymentDueAmount,
    LocalDate paymentDueDate,
    Long rewardPoints,
    /** Non-null only for Revolut pocket sub-accounts; the parent wallet's account id. */
    Long parentAccountId,
    boolean hidden,
    /**
     * The viewing member's percentage of this account, or null when it is wholly theirs.
     *
     * <p>Null rather than 100 on purpose: it lets the UI treat "co-owned" as a distinct
     * state to badge, without every ordinary account carrying a meaningless 100%.
     */
    BigDecimal sharePercent,
    /**
     * Whether the viewing member administers this account.
     *
     * <p>Distinct from holding a share: a co-owner reads the account and counts their part of
     * it, but only the owner may edit, revalue or delete it. The UI needs this to hide write
     * actions rather than letting the user discover the rule through a 403.
     */
    Boolean isOwner,
    /** Present only for a {@code SCPI} account. Null everywhere else. */
    ScpiPositionResponse scpi,
    /** How a bank card is debited; non-null only for synced cards whose bank says so. */
    CardNature cardNature,
    /** Contract facts a provider reports (CORUM Life); null when it reports none. */
    AccountContractResponse contract,
    /** The bank behind an aggregator account (SimpleFIN); null when {@code provider} already is the bank. */
    InstitutionResponse institution,
    /** A PEA's stated contribution ceiling; null when unset (the UI applies the legal default). */
    BigDecimal depositCeiling,
    /** Cost basis in EUR, reported for a PEA only: its contribution ceiling is measured against it. */
    BigDecimal investedEur
) {
    /** Pre-deposit-ceiling shape, kept so existing callers need not name the new components. */
    public AccountResponse(Long id, String name, AccountType type, String provider, String currency,
        BigDecimal currentBalance, BigDecimal currentBalanceEur, BigDecimal cashBalance, Instant lastSyncedAt,
        boolean isManual, String color, String ticker, String logoUrl, String logoKey, Instant createdAt,
        LocalDate openedAt, RealEstateMetadataResponse realEstate, DebtResponse debt, SavingsConfigDto savingsConfig,
        BigDecimal paymentDueAmount, LocalDate paymentDueDate, Long rewardPoints,
        Long parentAccountId, boolean hidden, BigDecimal sharePercent, Boolean isOwner,
        ScpiPositionResponse scpi, CardNature cardNature, AccountContractResponse contract,
        InstitutionResponse institution) {
        this(id, name, type, provider, currency, currentBalance, currentBalanceEur, cashBalance, lastSyncedAt,
            isManual, color, ticker, logoUrl, logoKey, createdAt, openedAt, realEstate, debt, savingsConfig,
            paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi,
            cardNature, contract, institution, null, null);
    }

    /** Pre-institution shape, kept so existing callers need not name the new component. */
    public AccountResponse(Long id, String name, AccountType type, String provider, String currency,
        BigDecimal currentBalance, BigDecimal currentBalanceEur, BigDecimal cashBalance, Instant lastSyncedAt,
        boolean isManual, String color, String ticker, String logoUrl, String logoKey, Instant createdAt,
        LocalDate openedAt, RealEstateMetadataResponse realEstate, DebtResponse debt, SavingsConfigDto savingsConfig,
        BigDecimal paymentDueAmount, LocalDate paymentDueDate, Long rewardPoints,
        Long parentAccountId, boolean hidden, BigDecimal sharePercent, Boolean isOwner,
        ScpiPositionResponse scpi, CardNature cardNature, AccountContractResponse contract) {
        this(id, name, type, provider, currency, currentBalance, currentBalanceEur, cashBalance, lastSyncedAt,
            isManual, color, ticker, logoUrl, logoKey, createdAt, openedAt, realEstate, debt, savingsConfig,
            paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi,
            cardNature, contract, null);
    }

    /** Pre-contract shape, kept so existing callers need not name the new component. */
    public AccountResponse(Long id, String name, AccountType type, String provider, String currency,
        BigDecimal currentBalance, BigDecimal currentBalanceEur, BigDecimal cashBalance, Instant lastSyncedAt,
        boolean isManual, String color, String ticker, String logoUrl, String logoKey, Instant createdAt,
        LocalDate openedAt, RealEstateMetadataResponse realEstate, DebtResponse debt, SavingsConfigDto savingsConfig,
        BigDecimal paymentDueAmount, LocalDate paymentDueDate, Long rewardPoints,
        Long parentAccountId, boolean hidden, BigDecimal sharePercent, Boolean isOwner,
        ScpiPositionResponse scpi, CardNature cardNature) {
        this(id, name, type, provider, currency, currentBalance, currentBalanceEur, cashBalance, lastSyncedAt,
            isManual, color, ticker, logoUrl, logoKey, createdAt, openedAt, realEstate, debt, savingsConfig,
            paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi,
            cardNature, null, null);
    }

    /** Pre-card-nature shape, kept so existing callers need not name the new component. */
    public AccountResponse(Long id, String name, AccountType type, String provider, String currency,
        BigDecimal currentBalance, BigDecimal currentBalanceEur, BigDecimal cashBalance, Instant lastSyncedAt,
        boolean isManual, String color, String ticker, String logoUrl, String logoKey, Instant createdAt,
        LocalDate openedAt, RealEstateMetadataResponse realEstate, DebtResponse debt, SavingsConfigDto savingsConfig,
        BigDecimal paymentDueAmount, LocalDate paymentDueDate, Long rewardPoints,
        Long parentAccountId, boolean hidden, BigDecimal sharePercent, Boolean isOwner,
        ScpiPositionResponse scpi) {
        this(id, name, type, provider, currency, currentBalance, currentBalanceEur, cashBalance, lastSyncedAt,
            isManual, color, ticker, logoUrl, logoKey, createdAt, openedAt, realEstate, debt, savingsConfig,
            paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi,
            null);
    }

    public AccountResponse(Long id, String name, AccountType type, String provider, String currency,
        BigDecimal currentBalance, BigDecimal currentBalanceEur, BigDecimal cashBalance, Instant lastSyncedAt,
        boolean isManual, String color, String ticker, String logoUrl, String logoKey, Instant createdAt,
        LocalDate openedAt, RealEstateMetadataResponse realEstate, DebtResponse debt, SavingsConfigDto savingsConfig,
        Long parentAccountId, boolean hidden, BigDecimal sharePercent, Boolean isOwner,
        ScpiPositionResponse scpi) {
        this(id, name, type, provider, currency, currentBalance, currentBalanceEur, cashBalance, lastSyncedAt,
            isManual, color, ticker, logoUrl, logoKey, createdAt, openedAt, realEstate, debt, savingsConfig,
            null, null, null, parentAccountId, hidden, sharePercent, isOwner, scpi, null);
    }

    public static AccountResponse from(Account a, BigDecimal balanceEur) {
        return new AccountResponse(
            a.getId(),
            a.getName(),
            a.getType(),
            a.getProvider(),
            a.getCurrency(),
            a.getCurrentBalance(),
            balanceEur,
            a.getCashBalance(),
            a.getLastSyncedAt(),
            a.isManual(),
            a.getColor(),
            a.getTicker(),
            a.getLogoUrl(),
            a.getLogoKey(),
            a.getCreatedAt(),
            a.getOpenedAt(),
            null,
            null,
            null,
            a.getPaymentDueAmount(),
            a.getPaymentDueDate(),
            a.getRewardPoints(),
            a.getParentAccountId(),
            a.isHidden(),
            null,
            null,
            null,
            a.getCardNature(),
            AccountContractResponse.from(a),
            InstitutionResponse.from(a),
            a.getDepositCeiling(),
            null
        );
    }

    public AccountResponse withRealEstate(RealEstateMetadataResponse realEstate) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    public AccountResponse withDebt(DebtResponse debt) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    /** Test and adapter seam; the mapping from the entity already carries it. */
    public AccountResponse withOpenedAt(LocalDate openedAt) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    public AccountResponse withSavingsConfig(SavingsConfigDto savingsConfig) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    public AccountResponse withViewer(BigDecimal sharePercent, Boolean isOwner) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    public AccountResponse withInvestedEur(BigDecimal investedEur) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    public AccountResponse withScpi(ScpiPositionResponse scpi) {
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract, institution, depositCeiling, investedEur);
    }

    /**
     * The logo endpoint serves only the owner's own accounts, so a co-owner is not promised one:
     * the bank's name stays, the request for a logo that would 404 does not happen.
     */
    public AccountResponse withoutInstitutionLogo() {
        if (institution == null || !institution.hasLogo()) return this;
        return new AccountResponse(id, name, type, provider, currency, currentBalance,
            currentBalanceEur, cashBalance, lastSyncedAt, isManual, color, ticker, logoUrl, logoKey,
            createdAt, openedAt, realEstate, debt, savingsConfig, paymentDueAmount, paymentDueDate, rewardPoints, parentAccountId, hidden, sharePercent, isOwner, scpi, cardNature, contract,
            new InstitutionResponse(institution.name(), false), depositCeiling, investedEur);
    }
}
