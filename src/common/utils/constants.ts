/** Matches a canonical UUID (any version). Booking ids are UUIDs. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pragmatic email check: something@domain.tld, no spaces. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Booking rate limit: at most RATE_LIMIT_MAX_ATTEMPTS per email in a sliding window of this many seconds. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Time units in milliseconds. */
export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** Demo slots seeded into an empty database on boot. */
export const DEMO_PROVIDERS = ['Dr Ade', 'Dr Bello'];
export const DEMO_DAYS = 5; // starting tomorrow
export const DEMO_SLOTS_PER_DAY = 4; // per provider
export const DEMO_FIRST_SLOT_HOUR_UTC = 9;
export const DEMO_SLOT_MINUTES = 30;
