package com.picsou.migration;

import com.picsou.support.PostgresContainers;
import com.picsou.support.RequiresPostgres;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves a database at V141 upgrades in place: existing accounts keep a NULL deposit ceiling
 * (the legal default applies), a stated one is stored, and a non-positive one is refused.
 */
@RequiresPostgres
class V152AccountDepositCeilingMigrationTest {

    private static final String INSERT_ACCOUNT =
        "INSERT INTO account (name, type, currency, current_balance, is_manual, member_id) "
            + "VALUES (?, 'PEA'::account_type, 'EUR', 0, true, ?) RETURNING id";
    private static final String SET_CEILING = "UPDATE account SET deposit_ceiling = ? WHERE id = ?";
    private static final String READ_CEILING = "SELECT deposit_ceiling FROM account WHERE id = ?";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresContainers.newContainer();

    @BeforeAll
    static void migrateToV141() {
        flyway("151").migrate();
    }

    private static Flyway flyway(String target) {
        return Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration")
            .target(target)
            .load();
    }

    private static long insert(String sql, String name, Long member) throws SQLException {
        try (Connection c = PostgresContainers.connection(POSTGRES); PreparedStatement st = c.prepareStatement(sql)) {
            st.setString(1, name);
            if (member != null) st.setLong(2, member);
            try (ResultSet rs = st.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    private static void setCeiling(long account, BigDecimal ceiling) throws SQLException {
        try (Connection c = PostgresContainers.connection(POSTGRES); PreparedStatement st = c.prepareStatement(SET_CEILING)) {
            st.setBigDecimal(1, ceiling);
            st.setLong(2, account);
            st.executeUpdate();
        }
    }

    private static BigDecimal readCeiling(long account) throws SQLException {
        try (Connection c = PostgresContainers.connection(POSTGRES); PreparedStatement st = c.prepareStatement(READ_CEILING)) {
            st.setLong(1, account);
            try (ResultSet rs = st.executeQuery()) {
                assertThat(rs.next()).isTrue();
                return rs.getBigDecimal(1);
            }
        }
    }

    @Test
    void addsANullableDepositCeiling_keepsExistingRows_andRefusesANonPositiveOne() throws SQLException {
        long member = insert("INSERT INTO family_member (display_name) VALUES (?) RETURNING id", "before-v152", null);
        long existing = insert(INSERT_ACCOUNT, "existing-pea", member);

        assertThat(flyway("152").migrate().migrationsExecuted).isEqualTo(1);

        assertThat(readCeiling(existing)).isNull();
        setCeiling(existing, new BigDecimal("20000"));
        assertThat(readCeiling(existing)).isEqualByComparingTo("20000");
        assertThatThrownBy(() -> setCeiling(existing, BigDecimal.ZERO)).hasMessageContaining("ck_account_deposit_ceiling");
    }
}
