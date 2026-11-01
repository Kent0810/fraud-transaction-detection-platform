# @platform/db

Prisma client for the platform Postgres, shared by the TypeScript apps.

**Flyway owns the schema** (`infra/postgres/migrations`). This package only reads it: never run `prisma migrate` or
`prisma db push`. Rules that Prisma can't express stay in the database and still apply: check constraints, the
append-only triggers on `ledger_entries` and `transactions`, partial and expression indexes, and each app login's grants.

## Use it from an app

```jsonc
// package.json
"@platform/db": "file:../../../packages/db"   // path relative to the app
```

```ts
import { createPrismaClient, requestTransfer, settle, TransferRefusedError } from '@platform/db';

const db = createPrismaClient({ host, port, database, user, password }); // the app's own login
await db.accounts.findUnique({ where: { card_id } });
await requestTransfer(db, { fromCard, password, transferId, toAccount, amount, content });
// …later, for every transaction (card payment or transfer), from the fraud detector's decisions topic:
await settle(db, { txnId, cardId, channel, ts, merchant, category, amount, merchLat, merchLong, verdict, firedRules });
```

Move money only through these. `requestTransfer()` records a transfer as PENDING with a `TransactionRequested`
outbox event (`transactions` topic) for the fraud detector, and is safe to retry with the same `transferId`. The
recipient is looked up by account number, and its name comes from the cardholder. `requestPayment()` does the same for a
card payment made in the app (retry with the same `paymentId`). `settle()` applies a decision, approving only `ALLOW`: for
a transfer it posts the ledger entries and both balances (locking in a fixed order) or declines it; a card payment, PENDING
from the app or recorded now from the event source, gets its `CARD_PAYMENT` entry, and is declined with
`INSUFFICIENT_FUNDS` or `FROZEN` when the account can't pay. Either way a `TransactionPosted` or `TransactionDeclined` event goes to the `settlements` topic
in the same transaction, and a decision delivered twice changes nothing. Don't write those tables any other way: an app
login may update `accounts.balance` and insert history, so a hand-rolled write would pass the grants and break the
ledger. Refusals arrive as `TransferRefusedError` with a code such as `INSUFFICIENT_FUNDS`.

Build it before the app: `npm ci && npm run build` here, then `npm ci` in the app. A Docker image needs the platform
directory as its build context; see `services/card-holder-app/backend/Dockerfile`.

## After a new migration

```sh
npm run pull    # throwaway Postgres + the Flyway migrations + prisma db pull → prisma/schema.prisma
npm run build
npm run check   # CI: fails if prisma/schema.prisma no longer matches the migrations
```

Both scripts need Docker. Commit the updated `prisma/schema.prisma`.

## Things to know

- `bigint` columns (`balance`, `amount`, `entry_id`) come back as `BigInt`. Convert with `Number()` before JSON.
- `flyway_schema_history` appears as a model because introspection can't skip it. Don't use it.
- The partial unique index "one OPENING entry per card" makes Prisma treat `ledger_entries.card_id` as unique, so
  `accounts.ledger_entries` is typed as one row. Query `ledger_entries` by `card_id` with `findMany` instead.
