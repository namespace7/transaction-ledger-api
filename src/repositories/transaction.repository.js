import pool from "../config/database.js";

/**
 * 1.Lock the account row using SELECT ... FOR UPDATE.
 * 2.Confirm the account exists.
 * 3.Check whether the account has the supplied reference_id.
 * 4.Reject a debit if the account balance is insufficient.
 * 5.Insert the transaction record.
 * 6.Update the account balance using SQL arithmetic.
 * 7.Commit both changes together; otherwise, roll back.
 */

class LedgerError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function create(accountId, transaction) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Serialize transactions for this account.
    const accountResult = await client.query(
      `SELECT id FROM accounts WHERE id = $1 FOR UPDATE`,
      [accountId],
    );

    if (accountResult.rowCount === 0) {
      throw new LedgerError(404, "ACCOUNT_NOT_FOUND", "Account not found");
    }

    // Check idempotency after acquiring the account lock.
    const duplicateResult = await client.query(
      `SELECT id FROM transactions WHERE account_id = $1 AND reference_id = $2`,
      [accountId, transaction.reference_id],
    );

    if (duplicateResult.rowCount > 0) {
      throw new LedgerError(
        409,
        "DUPLICATE_REFERENCE",
        "This reference ID has already been used for this account.",
      );
    }

    const operator = transaction.type === "credit" ? "+" : "-";

    // Debit updates are conditional, so the balance cannot go negative.
    const balanceResult = await client.query(
      `
        UPDATE accounts 
        SET balance = balance ${operator} $1::numeric 
        WHERE id = $2 
            AND ($3 = 'credit' OR balance >= $1::numeric) 
        RETURNING id, balance`,
      [transaction.amount, accountId, transaction.type],
    );

    if (balanceResult.rowCount === 0) {
      throw new LedgerError(
        409,
        "INSUFFICIENT_FUNDS",
        "The account has insufficient funds for this debit.",
      );
    }

    const transactionResult = await client.query(
      `INSERT INTO transactions
            (account_id, type, amount, description, reference_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, account_id, type, amount, description,
                reference_id, created_at`,
      [
        accountId,
        transaction.type,
        transaction.amount,
        transaction.description,
        transaction.reference_id,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      transaction: transactionResult.rows[0],
      balance: balanceResult.rows[0].balance,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
    }

    // Keep the database constraint as the final duplicate safeguard.
    if (error.code === "23505") {
      throw new LedgerError(
        409,
        "DUPLICATE_REFERENCE",
        "This reference ID has already been used for this account.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getBalance(accountId) {
  const result = await pool.query(
    `SELECT id, balance
        FROM accounts
        WHERE id = $1`,
    [accountId],
  );

  return result.rows[0] || null;
}

async function getHistory(accountId, { type, limit, offset }) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;

    const accountResult = await client.query(
      "SELECT id FROM accounts WHERE id = $1",
      [accountId],
    );

    if (accountResult.rowCount === 0) {
      throw new LedgerError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
    }

    const conditions = ["account_id = $1"];
    const params = [accountId];

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `SELECT COUNT(*)::integer AS total
       FROM transactions
       WHERE ${whereClause}`,
      params,
    );

    params.push(limit);
    const limitPosition = params.length;

    params.push(offset);
    const offsetPosition = params.length;

    const transactionsResult = await client.query(
      `SELECT id, account_id, type, amount, description,
              reference_id, created_at
       FROM transactions
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitPosition}
       OFFSET $${offsetPosition}`,
      params,
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      transactions: transactionsResult.rows,
      total: countResult.rows[0].total,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Read transaction rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function transfer(data) {
  const client = await pool.connect();
  let transactionStarted = false;

  const {
    source_account_id,
    destination_account_id,
    amount,
    description,
    reference_id,
  } = data;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Lock both accounts in a consistent order to reduce deadlocks.
    const accountIds = [source_account_id, destination_account_id].sort();

    const accountsResult = await client.query(
      `SELECT id, balance
       FROM accounts
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [accountIds],
    );

    if (accountsResult.rowCount !== 2) {
      throw new LedgerError(
        404,
        "ACCOUNT_NOT_FOUND",
        "Source or destination account not found.",
      );
    }

    // Check the transfer reference against both accounts.
    const duplicateResult = await client.query(
      `SELECT account_id
       FROM transactions
       WHERE account_id = ANY($1::uuid[])
         AND reference_id = $2`,
      [accountIds, reference_id],
    );

    if (duplicateResult.rowCount > 0) {
      throw new LedgerError(
        409,
        "DUPLICATE_REFERENCE",
        "This reference ID has already been used for one of the accounts.",
      );
    }

    // Debit only when the source has sufficient funds.
    const debitResult = await client.query(
      `UPDATE accounts
       SET balance = balance - $1::numeric
       WHERE id = $2
         AND balance >= $1::numeric
       RETURNING id, balance`,
      [amount, source_account_id],
    );

    if (debitResult.rowCount === 0) {
      throw new LedgerError(
        409,
        "INSUFFICIENT_FUNDS",
        "The source account has insufficient funds.",
      );
    }

    const creditResult = await client.query(
      `UPDATE accounts
       SET balance = balance + $1::numeric
       WHERE id = $2
       RETURNING id, balance`,
      [amount, destination_account_id],
    );

    if (creditResult.rowCount === 0) {
      throw new LedgerError(
        404,
        "ACCOUNT_NOT_FOUND",
        "Destination account not found.",
      );
    }

    const debitTransaction = await client.query(
      `INSERT INTO transactions
         (account_id, type, amount, description, reference_id)
       VALUES ($1, 'debit', $2, $3, $4)
       RETURNING id, account_id, type, amount, description,
                 reference_id, created_at`,
      [source_account_id, amount, description, reference_id],
    );

    const creditTransaction = await client.query(
      `INSERT INTO transactions
         (account_id, type, amount, description, reference_id)
       VALUES ($1, 'credit', $2, $3, $4)
       RETURNING id, account_id, type, amount, description,
                 reference_id, created_at`,
      [destination_account_id, amount, description, reference_id],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      source_balance: debitResult.rows[0].balance,
      destination_balance: creditResult.rows[0].balance,
      debit_transaction: debitTransaction.rows[0],
      credit_transaction: creditTransaction.rows[0],
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Transfer rollback failed:", rollbackError);
      }
    }

    if (error.code === "23505") {
      throw new LedgerError(
        409,
        "DUPLICATE_REFERENCE",
        "This reference ID has already been used for one of the accounts.",
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export { LedgerError };

export default {
  create,
  getBalance,
  getHistory,
  transfer,
};
