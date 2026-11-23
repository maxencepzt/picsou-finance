-- The contribution ceiling a member states for a PEA (150 000 EUR for a classic PEA, 20 000 EUR
-- for a PEA jeune). Nullable: no value means the regulatory default applies (frontend constant).
ALTER TABLE account ADD COLUMN deposit_ceiling NUMERIC(20, 2);

ALTER TABLE account ADD CONSTRAINT ck_account_deposit_ceiling
    CHECK (deposit_ceiling IS NULL OR deposit_ceiling > 0);
