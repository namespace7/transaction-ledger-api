# Transaction Ledger API

A backend API for managing accounts, credit and debit transactions,
account balances, and transaction history.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- pg
- Zod
- Vitest and Supertest

## Prerequisites

- Node.js
- npm
- PostgreSQL

## Local Setup

1. Install dependencies:

   npm ci

2. Create a PostgreSQL database named `transaction_ledger_dev`.

3. Copy `.env.example` to `.env` and configure `DATABASE_URL`.

4. Apply the database schema:

   psql -d transaction_ledger_dev -v ON_ERROR_STOP=1 \
     -f migrations/001_create_ledger_tables.sql

## Development

The API startup script will be available through:

    npm run dev

API endpoints and testing instructions will be documented as they are implemented.
