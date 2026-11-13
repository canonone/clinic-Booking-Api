# Clinic Booking API

A booking API for a clinic, with a small web page that uses it. Patients can see available slots, book one, look up the booking and cancel it.

Built with **NestJS**, **TypeORM** and **PostgreSQL** (Neon in production). It is deployed on Render.

- **Live API and web page:** https://clinic-booking-api-g60u.onrender.com
- **API contract:** [koyaacademy.com/assessment-api](https://koyaacademy.com/assessment-api)

## Features

| Level | What it covers |
|---|---|
| 1 | List slots, book a slot, look up a booking, reset slots |
| 2 | API key on every request (`X-API-Key`, otherwise 401). Validates `slot_id`, `name` and `email` (400), rejects unknown slots (404) and slots that have already started (400) |
| 3 | No double booking, even for simultaneous requests (409). Bookings can be cancelled, which frees the slot |
| 4 | `Idempotency-Key` header: a retry never creates a second booking, and the same key with a different body returns 422. Cursor pagination of a person's bookings |
| 5 | Rate limit of 5 booking attempts per email per minute, failed attempts included. The 6th returns 429 with `Retry-After` |

Every error response has the shape `{"error": "<message>"}`.

## Endpoints

Every endpoint needs the `X-API-Key` header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/reset` | Delete all bookings and replace all slots with the request body's `slots` |
| `GET` | `/slots?provider=` | All slots, earliest first, each with `available` |
| `POST` | `/bookings` | Book a slot: `{ "slot_id", "name", "email" }`. Optional `Idempotency-Key` header |
| `GET` | `/bookings?email=&limit=&cursor=` | One person's bookings, oldest first. `limit` is 1–50 (default 10). Pass `next_cursor` back as `cursor` |
| `GET` | `/bookings/:id` | Get one booking |
| `DELETE` | `/bookings/:id` | Cancel a booking (409 if it's already cancelled) |

The web page is served at `/` and needs no key to load. It asks for the API key and keeps it in the browser only. The key is never built into the page.

```bash
curl -H "X-API-Key: $API_KEY" https://clinic-booking-api-g60u.onrender.com/slots
```

## How the guarantees work

All of these are enforced by Postgres, so they still hold with several app instances running.

- **No double booking.** A partial unique index on `bookings(slot_id) WHERE status = 'confirmed'` allows at most one confirmed booking per slot. The insert uses `ON CONFLICT DO NOTHING`, so when requests race the database picks the winner and every other request gets 409. A cancelled booking no longer matches the index, so its slot can be booked again.
- **Idempotency.** The `Idempotency-Key` row is claimed in the same transaction as the booking. A concurrent request with the same key waits on that row, then replays the stored status and body, so the booking `id` is the same. The request body is hashed with its keys sorted, so the same key with a different body returns 422.
- **Rate limiting.** Each attempt is stored in `booking_attempts`. A transaction-scoped advisory lock per email serializes that email's requests, so parallel requests can't all get under the limit. The window slides: each attempt expires exactly 60 seconds after it was made, and `Retry-After` is the number of whole seconds until the oldest one expires.
- **Pagination.** Bookings have an auto-incrementing `seq`. The cursor is the last `seq` returned, base64url-encoded, so paging is stable and never skips or repeats a row.
- **Exact timestamps.** Slot `start` and `end` are returned exactly as they were sent to `/reset`. Parsed copies are stored separately for sorting and for the "already started" check.

## Project structure

```
src/
├── main.ts                 Bootstrap: loads .env, serves public/, listens on PORT
├── app.module.ts           Wires TypeORM and the feature modules
├── database/
│   ├── database.config.ts  Reads DATABASE_URL / PGSSL into a typed config
│   └── typeorm.config.ts   TypeORM connection options
├── common/
│   ├── entities/           AbstractEntity (uuid id, created_at, updated_at)
│   ├── exceptions/         TooManyRequests (429 + Retry-After)
│   ├── filters/            JsonErrorFilter: every error becomes {"error": "..."}
│   ├── guards/             ApiKeyGuard (constant-time key comparison)
│   ├── schemas/            Error response schema
│   ├── types/              Shared types
│   └── utils/              Constants, request-body hashing
└── modules/
    ├── slots/              Controller, service, entity, DTOs, schemas, utils
    └── bookings/           Controller, service, entities, DTOs, schemas, mapper
public/index.html           The web page
scripts/e2e.ts              End-to-end test suite
```

- **DTOs** (`dto/`) type the incoming requests.
- **Schemas** (`schemas/`) mirror the response shapes in the API contract.
- **Entities** (`entities/`) are the database tables.

Request validation lives in the services rather than a validation pipe. That way invalid requests still count toward the rate limit and are still stored for idempotency replays, as the contract requires.

## Running locally

Requires Node 20 or later and Docker.

```bash
# 1. Start a Postgres container
docker run -d --name clinic-booking-test-db \
  -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=clinic -p 54331:5432 postgres:16

# 2. Configure the environment
cp .env.example .env        # then set API_KEY

# 3. Install, build and run
npm ci
npm run build
npm start                   # http://localhost:3000
```

Tables are created automatically on startup by TypeORM `synchronize`. An empty database is seeded with 40 demo slots: 2 providers × 5 days × 4 half-hour slots.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `API_KEY` | Yes | Shared secret that clients send in the `X-API-Key` header. Generate one with `openssl rand -hex 16` |
| `DATABASE_URL` | Yes | Postgres connection string. Use the Neon URL in production and the Docker URL locally |
| `PORT` | No | Defaults to `3000`. Render sets it automatically |
| `PGSSL` | No | Set to `disable` to turn off TLS for a remote database. TLS is already off for `localhost` and `127.0.0.1` |

The app loads `.env` with dotenv. Variables that are already set in the environment, such as the ones on Render, take precedence.

## Testing

```bash
npx tsc -p tsconfig.test.json && node .test-build/scripts/e2e.js
```

The suite starts its own throwaway Postgres (`embedded-postgres`) and the real app, then makes over 50 HTTP checks across all five levels. These include 50 simultaneous bookings of one slot (exactly one succeeds), 10 concurrent requests with the same idempotency key, and 20 parallel requests against the rate limit. You don't need Docker or a `.env` to run it.

## Deployment (Render + Neon)

The service was created manually in the Render dashboard:

| Setting | Value |
|---|---|
| Build command | `npm install && npm run build` |
| Start command | `npm run start` |
| Health check path | `/` |
| Environment | `API_KEY`, `DATABASE_URL` (direct Neon connection string with `sslmode=require`) |
