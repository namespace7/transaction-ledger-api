CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL
        CHECK (length(trim(name)) > 0),
    balance NUMERIC(19, 2) NOT NULL DEFAULT 0.00
        CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL
        REFERENCES accounts(id) ON DELETE RESTRICT,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('credit', 'debit')),
    amount NUMERIC(19, 2) NOT NULL
        CHECK (amount > 0),
    description TEXT NOT NULL
        CHECK (length(trim(description)) > 0),
    reference_id VARCHAR(255) NOT NULL
        CHECK (length(trim(reference_id)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_transactions_account_reference
        UNIQUE (account_id, reference_id)
);

CREATE INDEX idx_transactions_account_created
    ON transactions (account_id, created_at DESC, id DESC);

CREATE INDEX idx_transactions_account_type_created
    ON transactions (account_id, type, created_at DESC, id DESC);
