/** Matches a canonical UUID (any version). Booking ids are UUIDs. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pragmatic email check: something@domain.tld, no spaces. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Booking rate limit: at most RATE_LIMIT_MAX_ATTEMPTS per email in a sliding window of this many seconds. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
