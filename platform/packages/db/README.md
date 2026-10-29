# @platform/db

Prisma client for the platform Postgres, shared by the TypeScript apps.

**Flyway owns the schema** (`infra/postgres/migrations`). This package only reads it: never run `prisma migrate` or
`prisma db push`. Rules that Prisma can't express stay in the database and still apply: check constraints, the
append-only triggers on `ledger_entries` and `transfers`, partial and expression indexes, and each app login's grants.

## Use it from an app

```jsonc
// package.json
"@platform/db": "file:../../../packages/db"   // path relative to the app
```

```ts
import { createPrismaClient, requestTransfer, settleTransfer, TransferRefusedError } from '@platform/db';

const db = createPrismaClient({ host, port, database, user, password }); // the app's own login
await db.accounts.findUnique({ where: { card_id } });
await requestTransfer(db, { fromCard, password, transferId, toBankCode, toAccount, toName, amount, content });
// …later, from the fraud detector's transfer-decisions topic:
await settleTransfer(db, { transferId, approve, firedRules });
```

Move money only through these two. `requestTransfer()` records the transfer as PENDING with a `TransferRequested` outbox
event for the fraud detector, and is safe to retry with the same `transferId`. `settleTransfer()` applies the decision:
it posts the ledger entries, both balances and `TransferPosted` in one transaction (locking in a fixed order), or closes
the transfer with `TransferDeclined`; a decision delivered twice changes nothing. Don't write those tables any
other way: an app login may update `accounts.balance` and insert history, so a hand-rolled write would pass the grants
and break the ledger. Refusals arrive as `TransferRefusedError` with a code such as `INSUFFICIENT_FUNDS`.

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
