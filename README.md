# Payment Checkout — Backend

Backend service for a single-product checkout flow: product lookup, transaction
creation, payment confirmation through a third-party payment gateway, and stock
management. Built with a Hexagonal Architecture (Ports & Adapters) and Railway
Oriented Programming (ROP) for explicit, type-safe error handling.

## Table of Contents

- [Architecture](#architecture)
- [Data Model](#data-model)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Testing & Coverage](#testing--coverage)
- [Security](#security)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Architecture

The service follows **Hexagonal Architecture (Ports & Adapters)**, separating
business logic from infrastructure concerns:

```
┌─────────────────────────────────────────────────────────┐
│                     Infrastructure                       │
│  ┌───────────────┐   ┌───────────────┐   ┌────────────┐  │
│  │  Controllers   │   │   DynamoDB     │   │  Payment   │  │
│  │  (NestJS/HTTP) │   │   Adapters     │   │  Gateway   │  │
│  └───────┬───────┘   └───────┬───────┘   │  Adapter   │  │
│          │                   │           └─────┬──────┘  │
└──────────┼───────────────────┼─────────────────┼─────────┘
           │                   │                 │
┌──────────┼───────────────────┼─────────────────┼─────────┐
│          ▼                   ▼                 ▼         │
│                     Application Layer                     │
│   GetProductUseCase · CreateTransactionUseCase             │
│   ConfirmPaymentUseCase · GetTransactionUseCase             │
└──────────┬──────────────────────────────────────┬─────────┘
           │                                       │
┌──────────▼───────────────────────────────────────▼─────────┐
│                          Domain                             │
│  Entities: Product, Customer, Delivery, Transaction          │
│  Ports: ProductRepository, TransactionRepository,            │
│         CustomerRepository, DeliveryRepository,               │
│         PaymentGateway                                        │
│  Result<T, E> — Railway Oriented Programming                  │
└───────────────────────────────────────────────────────────┘
```

Business rules never depend on frameworks or infrastructure — the domain layer
only knows about **ports** (interfaces). Infrastructure provides the
**adapters** (DynamoDB repositories, the payment gateway client, HTTP
controllers) that implement those ports. This keeps use cases fully unit
testable without touching a database or a network call.

**Railway Oriented Programming (ROP):** instead of throwing exceptions for
expected failure paths, use cases return a `Result<T, E>` that is either
`Ok<T>` or `Err<E>`. Errors are values, not control flow — they're mapped to
HTTP responses only at the controller boundary.

### Transaction state machine

```
PENDING ──► APPROVED
   │
   ├──────► DECLINED
   │
   └──────► ERROR
```

A transaction is created in `PENDING`, then transitions to a terminal state
(`APPROVED`, `DECLINED`, or `ERROR`) once the payment gateway confirms the
result. Terminal states are final — no further transitions are allowed.

---

## Data Model

| Table          | Partition Key   | Description                                            |
|----------------|------------------|----------------------------------------------------------|
| `Products`     | `id`             | Product catalog: name, price, description, stock         |
| `Transactions` | `id`             | Payment attempts, status, amount (product + base fee + delivery fee), product & customer refs |
| `Customers`    | `id`             | Buyer info captured at checkout                           |
| `Deliveries`   | `transactionId`  | Shipping address linked 1:1 to a transaction               |

DynamoDB was chosen for its serverless-friendly pricing model (pay-per-request)
and native fit with a Lambda-based deployment — no connection pooling or VPC
configuration needed for a small, single-table-per-entity workload like this.

**Pricing breakdown stored on the transaction:** every transaction keeps
`productAmountInCents`, `baseFeeInCents` (flat fee, always applied) and
`deliveryFeeInCents` as separate fields — not just a single total — so the
summary screen and the API response can both show the itemized breakdown
required by the checkout flow.

---

## Tech Stack

- **Runtime:** Node.js 20, TypeScript
- **Framework:** NestJS
- **Database:** DynamoDB (local via DynamoDB Local for development, real
  DynamoDB in AWS for production)
- **Validation:** `class-validator` / `class-transformer`
- **Testing:** Jest
- **Infrastructure as Code:** AWS CDK (TypeScript)
- **Deployment target:** AWS Lambda + API Gateway (serverless)

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
  (via Docker or the standalone jar) for local development
- AWS CLI configured (only needed for real AWS deployment or for inspecting
  DynamoDB Local with `--endpoint-url`)

### Installation

```bash
npm install
```

---

## Environment Variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable                 | Description                                              | Example                                |
|---------------------------|------------------------------------------------------------|-----------------------------------------|
| `PORT`                    | HTTP port for the Nest app                                  | `3000`                                   |
| `AWS_REGION`               | AWS region used by the DynamoDB SDK client                   | `us-east-1`                              |
| `DYNAMODB_ENDPOINT`        | Set to `http://localhost:8000` for local dev; leave unset for real AWS | `http://localhost:8000`         |
| `PRODUCTS_TABLE`           | DynamoDB table name for products                              | `Products`                                |
| `TRANSACTIONS_TABLE`       | DynamoDB table name for transactions                          | `Transactions`                            |
| `CUSTOMERS_TABLE`          | DynamoDB table name for customers                             | `Customers`                               |
| `DELIVERIES_TABLE`         | DynamoDB table name for deliveries                            | `Deliveries`                              |
| `PAYMENT_GATEWAY_BASE_LINK` | Base URL of the payment gateway's sandbox API                 | *(sandbox URL)*                           |
| `PAYMENT_GATEWAY_PUBLIC_KEY`  | Public key for the payment gateway sandbox                | *(sandbox key)*                           |
| `PAYMENT_GATEWAY_PRIVATE_KEY` | Private key for the payment gateway sandbox                | *(sandbox key)*                           |
| `PAYMENT_GATEWAY_INTEGRITY_SECRET` | Secret used to sign transaction integrity hashes      | *(sandbox secret)*                        |

---

## Running Locally

1. **Start DynamoDB Local** (example with Docker):

   ```bash
   docker run -p 8000:8000 amazon/dynamodb-local
   ```

2. **Create the local tables:**

   ```bash
   npx ts-node -r tsconfig-paths/register src/infrastructure/persistence/dynamodb/create-tables.local.ts
   ```

3. **Seed dummy products:**

   ```bash
   npm run seed
   ```

4. **Start the API in watch mode:**

   ```bash
   npm run start:dev
   ```

   The API will be available at `http://localhost:3000`.

5. **(Optional) Inspect DynamoDB Local data visually:**

   ```bash
   npx dynamodb-admin
   ```

   Opens a table browser at `http://localhost:8001` (make sure
   `DYNAMODB_ENDPOINT=http://localhost:8000` is set in the same shell before
   running this).

---

## API Endpoints

| Method | Path                              | Description                                             |
|--------|------------------------------------|-------------------------------------------------------------|
| `GET`  | `/products/:id`                    | Fetch a single product, including current stock              |
| `POST` | `/transactions`                    | Create a `PENDING` transaction for a product + customer + delivery info |
| `GET`  | `/transactions/:id`                 | Fetch the current status of a transaction                     |
| `POST` | `/transactions/:id/payments`        | Confirm payment with the gateway and settle the transaction (`APPROVED`/`DECLINED`/`ERROR`), adjusting stock accordingly |

A full request/response reference, including sample payloads, is available as
importable Postman collections in this repo — no external account needed:

- **Local** (`http://localhost:3000`): [`postman_collection/postman_collection_local.json`](./postman_collection/postman_collection_local.json)
- **AWS (deployed)**: [`postman_collection/postman_collection_aws.json`](./postman_collection/postman_collection_aws.json)

To use them: open Postman → **Import** → select the file. Both collections
already carry a `baseUrl` variable pointed at the right environment, and the
"Create transaction" request auto-saves the returned `transactionId` into the
collection variables so the following requests can reuse it.

---

## Testing & Coverage

```bash
npm run test        # unit tests
npm run test:cov    # unit tests with coverage report
```
-------------------------------------|---------|----------|---------|---------|-------------------
File                                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------------------------|---------|----------|---------|---------|-------------------
All files                            |   99.02 |    97.39 |     100 |   98.95 |                   
 application/use-cases               |   98.05 |    89.47 |     100 |   97.89 |                   
  confirm-payment.use-case.ts        |   97.72 |     90.9 |     100 |   97.61 | 90                
  create-transaction.use-case.ts     |   97.14 |       80 |     100 |   96.96 | 113               
  get-product.use-case.ts            |     100 |      100 |     100 |     100 |                   
  get-transaction.use-case.ts        |     100 |      100 |     100 |     100 |                   
 config                              |     100 |      100 |     100 |     100 |                   
  app.config.ts                      |     100 |      100 |     100 |     100 |                   
 domain/entities                     |     100 |      100 |     100 |     100 |                   
  customer.entity.ts                 |     100 |      100 |     100 |     100 |                   
  delivery.entity.ts                 |     100 |      100 |     100 |     100 |                   
  product.entity.ts                  |     100 |      100 |     100 |     100 |                   
  transaction.entity.ts              |     100 |      100 |     100 |     100 |                   
 domain/ports                        |     100 |      100 |     100 |     100 |                   
  payment-gateway.port.ts            |     100 |      100 |     100 |     100 |                   
  repositories.port.ts               |     100 |      100 |     100 |     100 |                   
 domain/shared                       |     100 |      100 |     100 |     100 |                   
  result.ts                          |     100 |      100 |     100 |     100 |                   
 infrastructure/http                 |     100 |      100 |     100 |     100 |                   
  http-error.mapper.ts               |     100 |      100 |     100 |     100 |                   
 infrastructure/http/controllers     |     100 |      100 |     100 |     100 |                   
  products.controller.ts             |     100 |      100 |     100 |     100 |                   
  transactions.controller.ts         |     100 |      100 |     100 |     100 |                   
 infrastructure/http/dtos            |     100 |      100 |     100 |     100 |                   
  confirm-payment.dto.ts             |     100 |      100 |     100 |     100 |                   
  create-transaction.dto.ts          |     100 |      100 |     100 |     100 |                   
 infrastructure/payment/gateway      |   96.34 |    94.73 |     100 |      96 |                   
  payment-gateway.adapter.ts         |   95.77 |    94.11 |     100 |   95.45 | 144-145,165       
  payment-gateway.utils.ts           |     100 |      100 |     100 |     100 |                   
 infrastructure/persistence/dynamodb |     100 |      100 |     100 |     100 |                   
  customer.repository.ts             |     100 |      100 |     100 |     100 |                   
  delivery.repository.ts             |     100 |      100 |     100 |     100 |                   
  product.repository.ts              |     100 |      100 |     100 |     100 |                   
  transaction.repository.ts          |     100 |      100 |     100 |     100 |                   
-------------------------------------|---------|----------|---------|---------|-------------------

Target of **≥ 80%** across the board is comfortably exceeded — and, unlike an
earlier version of this report, this one reflects **every file under `src/`**
(`collectCoverageFrom` is set explicitly in `package.json`), not just the
files a test happens to import transitively.

What's covered:
- Domain entities (`Product`, `Transaction` state machine, `Customer`,
  `Delivery`) — 100%
- Domain ports and `Result<T, E>` — 100%
- All 4 use cases (`CreateTransactionUseCase`, `ConfirmPaymentUseCase`,
  `GetProductUseCase`, `GetTransactionUseCase`) via mocked ports
- Both HTTP controllers (`ProductsController`, `TransactionsController`),
  asserting the DomainError → HTTP status mapping for each error branch
- Both DTOs (`CreateTransactionDto`, `ConfirmPaymentDto`), exercising real
  `class-validator` validation (valid payload, missing fields, invalid
  email/card format, unknown top-level properties)
- All 4 DynamoDB repository adapters, with a mocked `DynamoDBDocumentClient`
  asserting the exact `GetCommand`/`PutCommand` sent and the corrupted-record
  guard
- `PaymentGatewayAdapter` (tokenization, charge incl. the PENDING-polling
  branch, status lookup), with `axios` mocked — no real network call
- `app.config.ts`, including the "missing required env var" failure path
- Payment gateway utilities (integrity signature generation, card brand
  detection) — 100%

Excluded from coverage collection (pure wiring/bootstrap, not meaningfully
unit-testable): `main.ts`, `lambda.ts`, `app.module.ts` (DI wiring only),
`create-tables.local.ts` and `seed.ts` (one-off local dev scripts).

---

## Security

- [`helmet`](https://github.com/helmetjs/helmet) is enabled for baseline HTTP
  security headers (removes `X-Powered-By`, sets `X-Content-Type-Options`,
  `X-Frame-Options`, HSTS, and a restrictive default CSP).
- Input validation on every DTO via `class-validator`, rejecting malformed
  requests before they reach the domain layer.
- Sensitive credentials (gateway keys, integrity secret) are only read from
  environment variables — never hardcoded or logged.
- Card data is sent directly to the payment gateway; raw card numbers are
  never persisted in this service's database.

---

## Deployment

Infrastructure is defined as code with **AWS CDK** (TypeScript) in a separate
repository, provisioning:

- 4 DynamoDB tables (`Products`, `Transactions`, `Customers`, `Deliveries`)
- A single Lambda function running the entire NestJS app behind a proxy
  integration
- An API Gateway REST API in front of the Lambda

```bash
cd infraestructure
npm install
npm run deploy
```

**Live API URL (dev):** https://70zcpdhk46.execute-api.us-east-1.amazonaws.com/dev

---

## Project Structure

```
src/
├── domain/                 # Entities, Result<T,E>, ports (interfaces)
│   ├── entities/
│   └── ports/
├── application/
│   └── use-cases/          # Business use cases, orchestrating ports
├── infrastructure/
│   ├── http/                # NestJS HTTP controllers + DTOs
│   ├── persistence/
│   │   └── dynamodb/        # Repository adapters, table creation & seed scripts
│   └── payment/              # Payment gateway HTTP adapter
├── config/                  # Environment configuration loading
├── postman_collection/       # Local & AWS Postman collections (see API Endpoints)
└── app.module.ts             # Dependency injection wiring
```

---

## Related Repositories

- **Frontend (Vue 3 + Vuex checkout UI):** https://github.com/johancamilo/checkout-frontend
- **Infrastructure (AWS CDK):** https://github.com/johancamilo/checkout-infraestructure