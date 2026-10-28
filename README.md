# Transaction Ledger API

A RESTful backend API for managing financial accounts, recording credit and debit transactions, retrieving account balances, viewing transaction history, and transferring funds between accounts.

The API uses PostgreSQL transactions and row-level locking to maintain balance consistency when concurrent requests modify the same account.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** PostgreSQL
- **Database client:** `pg`
- **Validation:** Zod
- **Security middleware:** Helmet and CORS
- **Testing:** Vitest and Supertest

## Features

- Create accounts with unique UUIDs and an initial balance of zero.
- Retrieve account details.
- Credit and debit accounts.
- Reject debits and transfers when funds are insufficient.
- Enforce unique transaction reference IDs per account.
- Retrieve current account balances.
- Filter and paginate transaction history.
- Transfer funds atomically between two accounts.
- Validate request payloads and return structured errors.
- Enforce database constraints for valid financial records.

## Prerequisites

Install the following before running the project:

- Node.js compatible with the project runtime.
- npm.
- PostgreSQL.
- Git.

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd transaction-ledger-api
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Create the database

Create a local PostgreSQL database:

```bash
createdb transaction_ledger_dev
```

If your PostgreSQL setup requires a username or password, configure the appropriate connection settings for your environment.

### 4. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env` to match your PostgreSQL username and local configuration.

Example:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://your_user@localhost:5432/transaction_ledger_dev
DEBUG_SQL=false
```

Do not commit `.env` or real credentials to version control.

### 5. Apply the database migration

```bash
psql -d transaction_ledger_dev -v ON_ERROR_STOP=1 \
  -f migrations/001_create_ledger_tables.sql
```

Ensure the migration succeeds before starting the API.

## Running the API

Start the development server:

```bash
npm run dev
```

Start the server without nodemon:

```bash
npm start
```

The default port is `3000`, unless overridden by the `PORT` environment variable.

## Running Tests

Run the automated test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

The test suite covers health checks, account management, credits and debits, balance updates, duplicate references, transaction history, pagination, concurrent debit protection, and transfers.

## API Reference

All endpoints use the `/api` prefix and accept JSON request bodies where applicable.

### 1. Health Check

**`GET /api/health`**

Checks API and database connectivity.

Example response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected"
  }
}
```

### 2. Create an Account

**`POST /api/accounts`**

Request:

```json
{
  "name": "Savings Account"
}
```

The server generates the account UUID, initializes the balance to zero, and records the creation timestamp. Clients cannot provide an initial balance.

Example response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "account": {
      "id": "<generated-account-uuid>",
      "name": "Savings Account",
      "balance": "0.00",
      "created_at": "<timestamp>"
    }
  }
}
```

The returned balance and timestamp are examples of the expected fields; monetary values are represented as decimal strings by the PostgreSQL driver.

### 3. Retrieve an Account

**`GET /api/accounts/:id`**

Example:

```text
GET /api/accounts/<account-uuid>
```

Returns the account details for an existing UUID.

Possible errors include:

- `400 INVALID_ACCOUNT_ID` — malformed UUID.
- `404 ACCOUNT_NOT_FOUND` — valid UUID that does not identify an account.

### 4. Create a Credit or Debit

**`POST /api/accounts/:id/transactions`**

Credit request:

```json
{
  "type": "credit",
  "amount": 500.00,
  "description": "Initial deposit",
  "reference_id": "deposit-001"
}
```

Debit request:

```json
{
  "type": "debit",
  "amount": 100.00,
  "description": "Purchase",
  "reference_id": "purchase-001"
}
```

Rules:

- `type` must be `credit` or `debit`.
- `amount` must be positive and have at most two decimal places.
- `description` is required and must not exceed 1,000 characters.
- `reference_id` is required and must not exceed 255 characters.
- Unknown request fields are rejected.
- A credit increases the account balance.
- A debit decreases the account balance only if sufficient funds are available.
- Each accepted transaction is recorded in the ledger.

Successful creation returns `201 Created` with the created transaction and resulting balance information.

A debit with insufficient funds returns `409 INSUFFICIENT_FUNDS`. A duplicate reference within the same account is rejected without applying the transaction again.

### 5. Retrieve an Account Balance

**`GET /api/accounts/:id/transactions/balance`**

Example:

```text
GET /api/accounts/<account-uuid>/transactions/balance
```

Example response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "accountId": "<account-uuid>",
    "balance": "400.00"
  }
}
```

A missing account returns `404 ACCOUNT_NOT_FOUND`.

### 6. Retrieve Transaction History

**`GET /api/accounts/:id/transactions`**

Supported query parameters:

| Parameter | Required | Default | Rules |
|---|---|---|---|
| `type` | No | All types | `credit` or `debit` |
| `page` | No | `1` | Integer greater than or equal to 1 |
| `limit` | No | `20` | Integer from 1 to 100 |

Example:

```text
GET /api/accounts/<account-uuid>/transactions?type=debit&page=1&limit=10
```

The history is ordered newest first and includes pagination metadata.

Invalid filters, page numbers, or limits return `400 VALIDATION_ERROR`.

### 7. Transfer Funds

**`POST /api/transfers`**

Request:

```json
{
  "source_account_id": "<source-account-uuid>",
  "destination_account_id": "<destination-account-uuid>",
  "amount": 150.00,
  "description": "Shared expense",
  "reference_id": "transfer-001"
}
```

The source and destination must be different existing accounts. The amount must be positive and have at most two decimal places.

A successful transfer (`201 Created`) returns information about the resulting source and destination balances and the debit and credit ledger entries.

The transfer is performed atomically: both balance updates and both transaction records commit together. If validation, account lookup, duplicate-reference checks, or the insufficient-funds check fails, the operation is rolled back.

The implementation locks the involved accounts in a consistent order to reduce deadlock risk during concurrent transfers.

## Error Responses

Errors use a consistent JSON envelope.

Example validation error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction data.",
    "details": [
      {
        "field": "amount",
        "message": "..."
      }
    ]
  }
}
```

Common error codes include:

- `VALIDATION_ERROR` — invalid request body or query parameters.
- `INVALID_ACCOUNT_ID` — account identifier is not a valid UUID.
- `ACCOUNT_NOT_FOUND` — account does not exist.
- `INSUFFICIENT_FUNDS` — debit or transfer exceeds the available balance.
- `DUPLICATE_REFERENCE` — reference ID conflicts with an existing transaction.
- `ROUTE_NOT_FOUND` — endpoint does not exist.
- `INTERNAL_SERVER_ERROR` — unexpected server error.

The HTTP status code accompanies each error. Validation errors return `400`, missing accounts return `404`, and insufficient funds return `409`.

## Database Design

### Accounts

The accounts table stores:

- UUID primary key.
- Account name.
- Balance, initialized to zero.
- Creation timestamp.

### Transactions

The transactions table stores:

- UUID primary key.
- Account foreign key.
- Transaction type.
- Positive monetary amount.
- Description.
- Reference ID.
- Creation timestamp.

Database constraints enforce valid transaction types, positive amounts, non-negative balances, and uniqueness of `(account_id, reference_id)`.

Indexes support account transaction-history queries, including type filtering and newest-first ordering.

Transactions are treated as immutable ledger entries by the API: balance changes are represented by new transactions rather than editing existing records.

## Project Structure

```text
transaction-ledger-api/
├── migrations/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── app.js
│   └── server.js
├── tests/
├── docs/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

- **config:** database configuration.
- **controllers:** HTTP request and response handling.
- **middleware:** centralized error handling.
- **repositories:** database access and transactional SQL.
- **routes:** endpoint definitions.
- **services:** business logic.
- **validators:** request validation schemas.
- **migrations:** database schema.
- **tests:** automated API tests.

## Design Decisions and Assumptions

- Account IDs and transaction IDs are generated by the server.
- Account names are required; duplicate names are permitted because account-name uniqueness is not a requirement.
- Monetary amounts are stored in PostgreSQL `NUMERIC` columns to avoid binary floating-point storage for currency.
- Reference IDs are unique within an account rather than globally.
- Rejected financial operations must not leave partial balance changes or transaction records.
- Transfers are atomic across both accounts.
- Transaction history defaults to page 1 with a page size of 20 and caps the page size at 100.
