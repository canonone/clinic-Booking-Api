# Clinic booking API (NestJS + Postgres)

Env: `DATABASE_URL` (Postgres, e.g. Neon), `API_KEY`, `PORT` (set by host). Locally, copy `.env.example` to `.env` (loaded via dotenv).
Run: `npm ci && npm run build && npm start`. Tables are created on boot. Web page is served at `/`.
Test: `npx tsc -p tsconfig.test.json && node .test-build/scripts/e2e.js` (spins up an embedded Postgres).

How the guarantees work
- No double booking: partial unique index `ON bookings(slot_id) WHERE status='confirmed'`; the insert uses ON CONFLICT DO NOTHING -> 409.
- Idempotency: key row is claimed in the same transaction as the booking; concurrent same-key requests wait, then replay the stored response. Different body -> 422.
- Rate limit: 5 attempts/email/min (sliding window, stored in Postgres, serialized per email with an advisory lock); 429 + Retry-After.
