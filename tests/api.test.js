import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import pool from "../src/config/database.js";

const createdAccountIds = [];

async function createTestAccount(name) {
  const response = await request(app).post("/api/accounts").send({ name });

  expect(response.status).toBe(201);

  const account = response.body.data.account;
  createdAccountIds.push(account.id);

  return account;
}

describe("Health API", () => {
  it("reports that the API and database are healthy", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "healthy",
        database: "connected",
      },
    });
  });
});

describe("Account API", () => {
  let accountId;

  it("creates an account with a zero balance", async () => {
    const response = await request(app)
      .post("/api/accounts")
      .send({ name: `Test Account ${Date.now()}` });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.account).toMatchObject({
      name: expect.stringContaining("Test Account"),
      balance: "0.00",
    });
    expect(response.body.data.account.id).toBeDefined();
    expect(response.body.data.account.created_at).toBeDefined();

    accountId = response.body.data.account.id;
    createdAccountIds.push(accountId);
  });

  it("rejects a blank account name", async () => {
    const response = await request(app)
      .post("/api/accounts")
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not allow the client to set the balance", async () => {
    const response = await request(app)
      .post("/api/accounts")
      .send({ name: "Invalid Balance Account", balance: 500 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retrieves an existing account by ID", async () => {
    const response = await request(app).get(`/api/accounts/${accountId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.account.id).toBe(accountId);
  });

  it("rejects an invalid account UUID", async () => {
    const response = await request(app).get("/api/accounts/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ACCOUNT_ID");
  });

  it("returns 404 for a valid UUID that does not exist", async () => {
    const response = await request(app).get(
      "/api/accounts/00000000-0000-4000-8000-000000000001",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ACCOUNT_NOT_FOUND");
  });
});

describe("Transaction API", () => {
  let accountId;
  let secondAccountId;

  beforeAll(async () => {
    const account = await createTestAccount(
      `Ledger Test Account ${Date.now()}`,
    );
    const secondAccount = await createTestAccount(
      `Second Ledger Account ${Date.now()}`,
    );

    accountId = account.id;
    secondAccountId = secondAccount.id;
  });

  it("credits an account and increases its balance", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "credit",
        amount: 100.5,
        description: "Initial deposit",
        reference_id: "credit-001",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transaction).toMatchObject({
      account_id: accountId,
      type: "credit",
      amount: "100.50",
      description: "Initial deposit",
      reference_id: "credit-001",
    });
    expect(response.body.data.transaction.id).toBeDefined();
    expect(response.body.data.balance).toBe("100.50");
  });

  it("debits an account and decreases its balance", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "debit",
        amount: 30.25,
        description: "Purchase",
        reference_id: "debit-001",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.transaction.type).toBe("debit");
    expect(response.body.data.balance).toBe("70.25");
  });

  it("rejects a debit when funds are insufficient", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "debit",
        amount: 1000,
        description: "Unaffordable purchase",
        reference_id: "debit-insufficient",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_FUNDS");

    const balanceResponse = await request(app).get(
      `/api/accounts/${accountId}/transactions/balance`,
    );

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.data.balance).toBe("70.25");

    const historyResponse = await request(app).get(
      `/api/accounts/${accountId}/transactions?limit=100`,
    );

    expect(historyResponse.status).toBe(200);
    expect(
      historyResponse.body.data.transactions.some(
        (transaction) => transaction.reference_id === "debit-insufficient",
      ),
    ).toBe(false);
  });

  it("rejects duplicate reference IDs without changing the balance", async () => {
    const firstResponse = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "credit",
        amount: 5,
        description: "Reference test",
        reference_id: "duplicate-001",
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.data.balance).toBe("75.25");

    const duplicateResponse = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "debit",
        amount: 3,
        description: "Duplicate reference attempt",
        reference_id: "duplicate-001",
      });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe("DUPLICATE_REFERENCE");

    const balanceResponse = await request(app).get(
      `/api/accounts/${accountId}/transactions/balance`,
    );

    expect(balanceResponse.body.data.balance).toBe("75.25");
  });

  it("allows the same reference ID on a different account", async () => {
    const response = await request(app)
      .post(`/api/accounts/${secondAccountId}/transactions`)
      .send({
        type: "credit",
        amount: 7,
        description: "Different account",
        reference_id: "credit-001",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.transaction.reference_id).toBe("credit-001");
    expect(response.body.data.balance).toBe("7.00");
  });

  it("rejects invalid transaction amounts", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: "credit",
        amount: 0,
        description: "Invalid amount",
        reference_id: "invalid-amount-001",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the current balance", async () => {
    const response = await request(app).get(
      `/api/accounts/${accountId}/transactions/balance`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      accountId,
      balance: "75.25",
    });
  });

  it("filters history by type and paginates results", async () => {
    const firstPage = await request(app).get(
      `/api/accounts/${accountId}/transactions?type=credit&page=1&limit=1`,
    );

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.transactions).toHaveLength(1);
    expect(firstPage.body.data.transactions[0].type).toBe("credit");
    expect(firstPage.body.data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });

    const secondPage = await request(app).get(
      `/api/accounts/${accountId}/transactions?type=credit&page=2&limit=1`,
    );

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.transactions).toHaveLength(1);
    expect(secondPage.body.data.transactions[0].type).toBe("credit");

    expect(firstPage.body.data.transactions[0].id).not.toBe(
      secondPage.body.data.transactions[0].id,
    );
  });

  it("returns transaction history in latest-first order", async () => {
    const response = await request(app).get(
      `/api/accounts/${accountId}/transactions?limit=100`,
    );

    expect(response.status).toBe(200);

    const transactions = response.body.data.transactions;

    expect(transactions).toHaveLength(3);

    for (let index = 1; index < transactions.length; index += 1) {
      const previous = transactions[index - 1];
      const current = transactions[index];

      const previousTime = Date.parse(previous.created_at);
      const currentTime = Date.parse(current.created_at);

      if (previousTime === currentTime) {
        expect(previous.id.localeCompare(current.id)).toBeGreaterThan(0);
      } else {
        expect(previousTime).toBeGreaterThanOrEqual(currentTime);
      }
    }
  });

  it("prevents concurrent debits from overspending an account", async () => {
    const account = await createTestAccount(`Concurrency Test ${Date.now()}`);

    const creditResponse = await request(app)
      .post(`/api/accounts/${account.id}/transactions`)
      .send({
        type: "credit",
        amount: 100,
        description: "Concurrency test funding",
        reference_id: "concurrency-funding",
      });

    expect(creditResponse.status).toBe(201);

    const debitRequests = [
      request(app).post(`/api/accounts/${account.id}/transactions`).send({
        type: "debit",
        amount: 80,
        description: "Concurrent debit A",
        reference_id: "concurrency-debit-a",
      }),
      request(app).post(`/api/accounts/${account.id}/transactions`).send({
        type: "debit",
        amount: 80,
        description: "Concurrent debit B",
        reference_id: "concurrency-debit-b",
      }),
    ];

    const responses = await Promise.all(debitRequests);
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);

    const balanceResponse = await request(app).get(
      `/api/accounts/${account.id}/transactions/balance`,
    );

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.data.balance).toBe("20.00");

    const historyResponse = await request(app).get(
      `/api/accounts/${account.id}/transactions?limit=100`,
    );

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.pagination.total).toBe(2);
  });
});

afterAll(async () => {
  try {
    if (createdAccountIds.length > 0) {
      await pool.query(
        "DELETE FROM transactions WHERE account_id = ANY($1::uuid[])",
        [createdAccountIds],
      );

      await pool.query("DELETE FROM accounts WHERE id = ANY($1::uuid[])", [
        createdAccountIds,
      ]);
    }
  } finally {
    await pool.end();
  }
});
