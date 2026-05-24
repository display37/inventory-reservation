# Inventory Reservation System

A production-quality inventory reservation system built to prevent overselling during concurrent checkouts.

## The Core Problem

During checkout, payment takes time. Two naive approaches both fail:

| Approach | Problem |
|---|---|
| Decrement stock only after payment | Two users see stock=1, both pay, both succeed → **overselling** |
| Decrement stock immediately | Payment fails → stock is permanently lost → **inventory leak** |

**Solution:** Temporary reservations. Stock is *reserved* (not decremented) during checkout. Reservations expire after 10 minutes. On payment success → confirmed + permanently decremented. On failure/expiry → released back to available.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── products/route.ts          # GET /api/products
│   │   ├── warehouses/route.ts        # GET /api/warehouses
│   │   ├── reservations/
│   │   │   ├── route.ts               # POST /api/reservations
│   │   │   └── [id]/
│   │   │       ├── confirm/route.ts   # POST /api/reservations/:id/confirm
│   │   │       └── release/route.ts   # POST /api/reservations/:id/release
│   │   └── cron/
│   │       └── expire-reservations/route.ts
│   └── page.tsx                       # Product listing + reservation UI
├── services/
│   └── reservation.service.ts         # ALL business logic lives here
├── repositories/
│   ├── inventory.repository.ts        # SELECT FOR UPDATE + inventory mutations
│   ├── reservation.repository.ts      # Reservation CRUD
│   └── product.repository.ts          # Product + warehouse reads
├── lib/
│   ├── prisma.ts                      # Singleton Prisma client
│   ├── fetcher.ts                     # Typed SWR fetcher
│   └── api-response.ts                # Consistent HTTP response helpers
├── schemas/
│   └── reservation.schema.ts          # Zod validation schemas
├── hooks/
│   ├── useProducts.ts                 # SWR polling hook
│   └── useReservation.ts              # Reserve/confirm/release mutations
├── components/
│   ├── ProductCard.tsx
│   ├── ReservationPanel.tsx
│   ├── CountdownTimer.tsx
│   └── ErrorAlert.tsx
└── types/
    └── index.ts                       # Shared domain types
```

**Layer rules:**
- Route handlers → thin, only parse/validate/respond
- Services → all business logic, transaction orchestration
- Repositories → only DB access, no business logic
- No layer skips (routes never call repositories directly)

---

## Concurrency Design

### The Race Condition

```
T1: SELECT available=1  ✓
T2: SELECT available=1  ✓  ← reads stale data before T1 commits
T1: UPDATE reservedQty += 1, INSERT reservation
T2: UPDATE reservedQty += 1, INSERT reservation  ← OVERSELL
```

### The Fix: SELECT FOR UPDATE

```sql
-- Inside a transaction:
SELECT id, "totalQuantity", "reservedQuantity"
FROM "Inventory"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE  -- acquires exclusive row lock
```

```
T1: SELECT FOR UPDATE → acquires lock, available=1
T2: SELECT FOR UPDATE → BLOCKS (waits)
T1: UPDATE reservedQty += 1, INSERT reservation, COMMIT → releases lock
T2: unblocks, re-reads → available=0 → returns 409 Conflict
```

PostgreSQL guarantees that T2 sees T1's committed data after the lock is released. This is the only correct solution — no application-level locking, no Redis, no optimistic concurrency needed.

### Why Not Optimistic Locking?

Optimistic locking (version columns + retry) works well for low-contention scenarios. For inventory — especially flash sales — contention is *high by design*. Optimistic locking would cause a thundering herd of retries. Pessimistic locking (FOR UPDATE) serializes access cleanly.

### Atomic Status Transitions

Confirm and release use a conditional UPDATE:

```sql
UPDATE "Reservation"
SET status = 'CONFIRMED', "confirmedAt" = NOW()
WHERE id = $1 AND status = 'PENDING'  -- guard clause
RETURNING *
```

If the reservation was already released by the expiry job, this matches 0 rows → the service detects the conflict and returns 409. This prevents double-confirm and confirm-vs-expiry races without any additional locking.

### availableStock = totalQuantity - reservedQuantity

Never stored separately. Storing it would require 3-way consistency (totalQuantity + reservedQuantity + availableQuantity) in every transaction — double the writes, double the failure surface. Computing it at read time from two source-of-truth fields is always consistent.

---

## API Reference

| Method | Path | Description | Success | Error |
|---|---|---|---|---|
| GET | `/api/products` | List products with available stock | 200 | 500 |
| GET | `/api/warehouses` | List warehouses | 200 | 500 |
| POST | `/api/reservations` | Create reservation | 201 | 409 (no stock), 400 (invalid) |
| POST | `/api/reservations/:id/confirm` | Confirm reservation | 200 | 409 (finalized), 410 (expired), 404 |
| POST | `/api/reservations/:id/release` | Release reservation | 200 | 409 (finalized), 404 |
| GET | `/api/cron/expire-reservations` | Cleanup expired (cron) | 200 | 401 |

### Error Response Shape

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 0 unit(s) available, requested 1."
  }
}
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Steps

```bash
# 1. Clone and install
git clone <repo>
cd inventory-reservation
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL with your PostgreSQL credentials

# 3. Create database
psql -U postgres -c "CREATE DATABASE inventory_reservation;"

# 4. Run migrations
npm run db:migrate

# 5. Seed data
npm run db:seed

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# DATABASE_URL — your production PostgreSQL connection string
# RESERVATION_EXPIRY_MINUTES — 10
# CRON_SECRET — a strong random secret
```

`vercel.json` configures the cron job to run every minute automatically.

**Important:** Use a connection pooler (PgBouncer / Supabase pooler) in production. Serverless functions create a new DB connection per invocation — without pooling you'll exhaust PostgreSQL's connection limit quickly.

---

## Tradeoffs & Decisions

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Concurrency control | Pessimistic (FOR UPDATE) | Optimistic (version column) | High contention scenarios need serialization, not retries |
| Available stock | Computed (total - reserved) | Stored column | Eliminates 3-way consistency problem |
| Expiry mechanism | Cron job | DB triggers / event queue | Simpler, no additional infrastructure, good enough for 1-min granularity |
| Idempotency | DB status guard (WHERE status=PENDING) | Redis idempotency keys | Fewer moving parts, same correctness guarantee |
| Real-time updates | SWR polling (5s) | WebSockets / SSE | Sufficient for inventory use case, zero infrastructure |

---

## Future Improvements

1. **Multi-item reservations** — reserve multiple products in one transaction. Requires consistent lock ordering (always lock by productId ASC) to prevent deadlocks.
2. **User association** — add `userId` to reservations for per-user reservation limits.
3. **Webhook notifications** — notify users when their reservation is about to expire.
4. **Connection pooling** — add PgBouncer or use Supabase/Neon with built-in pooling for production serverless.
5. **Reservation quantity > 1** — currently UI reserves 1 unit; extend form to allow quantity selection.
6. **Audit log** — append-only event table for every status transition (useful for disputes).
7. **Metrics** — track reservation-to-confirm conversion rate, expiry rate, 409 rate per product.

---
