import { createHash } from 'crypto';
import { JsonValue } from '../types/json';

/** JSON.stringify replacer that sorts object keys, so the hash ignores key order. */
const sortKeys = (_key: string, v: JsonValue): JsonValue =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v;

/** SHA-256 of a request body; the same JSON in any key order gives the same hash. */
export const hashBody = (body: object | undefined): string =>
  createHash('sha256').update(JSON.stringify(body ?? null, sortKeys)).digest('hex');
