import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { TooManyRequests } from '../common/exceptions/too-many-requests.exception';
import { Slot } from '../slots/entities/slot.entity';
import { toBooking } from './booking.mapper';
import { Booking } from './entities/booking.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { BookingAttempt } from './entities/booking-attempt.entity';
import { JsonValue } from '../common/types/json';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { BookingPageSchema, BookingResult, BookingSchema } from './schemas/booking.schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 5;

/** JSON.stringify replacer that sorts object keys, so the hash ignores key order. */
const sortKeys = (_key: string, v: JsonValue): JsonValue =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v;
const hashBody = (b: CreateBookingDto | undefined) => createHash('sha256').update(JSON.stringify(b ?? null, sortKeys)).digest('hex');

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    private dataSource: DataSource,
  ) {}

  async create(body: CreateBookingDto, idemKey?: string): Promise<BookingResult> {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
    return this.dataSource.transaction(async (m): Promise<BookingResult> => {
      // Claim the idempotency key inside the same transaction as the booking. A concurrent request
      // with the same key blocks on this insert until we commit, then replays our stored result.
      if (idemKey) {
        const hash = hashBody(body);
        const ins = await m
          .createQueryBuilder()
          .insert()
          .into(IdempotencyKey)
          .values({ key: idemKey, bodyHash: hash, status: 0, response: null })
          .orIgnore()
          .returning('key')
          .execute();
        if (!ins.raw.length) {
          const prev = await m.findOneByOrFail(IdempotencyKey, { key: idemKey });
          if (prev.bodyHash !== hash) return { status: 422, body: { error: 'Idempotency-Key was already used with a different request body' } };
          if (!prev.response) throw new ConflictException('a request with this Idempotency-Key is still in progress');
          return { status: prev.status, body: prev.response };
        }
      }

      // Every attempt with an email counts, valid or not. Lock per email so parallel
      // requests cannot all slip under the limit.
      if (email) {
        await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
        await m.query(`DELETE FROM booking_attempts WHERE email = $1 AND at < clock_timestamp() - make_interval(secs => $2)`, [email, WINDOW_SECONDS]);
        const [row] = await m.query(
          `SELECT count(*)::int AS n,
                  ceil(extract(epoch FROM (min(at) + make_interval(secs => $2) - clock_timestamp())))::int AS wait
           FROM booking_attempts WHERE email = $1`,
          [email, WINDOW_SECONDS],
        );
        if (row.n >= MAX_ATTEMPTS) throw new TooManyRequests(Math.max(1, row.wait ?? WINDOW_SECONDS));
        await m.insert(BookingAttempt, { email });
      }

      const result = await this.book(m, body, email);
      if (idemKey) await m.update(IdempotencyKey, { key: idemKey }, { status: result.status, response: result.body });
      return result;
    });
  }

  private async book(m: DataSource['manager'], body: CreateBookingDto, email: string | null): Promise<BookingResult> {
    const bad = (error: string): BookingResult => ({ status: 400, body: { error } });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('request body must be a JSON object');
    const slotId = typeof body.slot_id === 'string' ? body.slot_id.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!slotId) return bad('slot_id is required');
    if (!name) return bad('name is required');
    if (!email) return bad('email is required');
    if (!EMAIL_RE.test(email)) return bad('email is not a valid email address');

    const slot = await m.findOneBy(Slot, { id: slotId });
    if (!slot) return { status: 404, body: { error: 'slot not found' } };
    if (slot.startAt.getTime() <= Date.now()) return bad('slot has already started');

    // ON CONFLICT DO NOTHING against the partial unique index: the database decides who wins.
    const ins = await m
      .createQueryBuilder()
      .insert()
      .into(Booking)
      .values({ slotId: slot.id, name, email, status: 'confirmed' })
      .orIgnore()
      .returning('id')
      .execute();
    if (!ins.raw.length) return { status: 409, body: { error: 'slot is already booked' } };
    return { status: 201, body: toBooking(await m.findOneByOrFail(Booking, { id: ins.raw[0].id })) };
  }

  async get(id: string): Promise<BookingSchema> {
    const b = UUID_RE.test(id) ? await this.bookings.findOneBy({ id }) : null; // non-uuid ids can't exist
    if (!b) throw new NotFoundException('booking not found');
    return toBooking(b);
  }

  async cancel(id: string): Promise<BookingSchema> {
    if (!UUID_RE.test(id)) throw new NotFoundException('booking not found');
    const upd = await this.bookings.update({ id, status: 'confirmed' }, { status: 'cancelled' });
    const b = await this.bookings.findOneBy({ id });
    if (!b) throw new NotFoundException('booking not found');
    if (!upd.affected) throw new ConflictException('booking is already cancelled');
    return toBooking(b);
  }

  async list({ email: emailRaw, limit: limitRaw, cursor: cursorRaw }: ListBookingsQueryDto): Promise<BookingPageSchema> {
    if (typeof emailRaw !== 'string' || !emailRaw.trim()) throw new BadRequestException('email query parameter is required');
    let limit = 10;
    if (limitRaw !== undefined) {
      if (typeof limitRaw !== 'string' || !/^\d+$/.test(limitRaw.trim())) throw new BadRequestException('limit must be an integer from 1 to 50');
      limit = parseInt(limitRaw, 10);
      if (limit < 1 || limit > 50) throw new BadRequestException('limit must be an integer from 1 to 50');
    }
    let after = 0;
    if (cursorRaw !== undefined && cursorRaw !== '') {
      const dec = typeof cursorRaw === 'string' ? Buffer.from(cursorRaw, 'base64url').toString() : '';
      if (!/^\d{1,18}$/.test(dec)) throw new BadRequestException('invalid cursor');
      after = parseInt(dec, 10);
    }
    const rows = await this.bookings.find({
      where: { email: emailRaw.trim().toLowerCase(), seq: MoreThan(String(after)) },
      order: { seq: 'ASC' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      bookings: page.map(toBooking),
      next_cursor: rows.length > limit ? Buffer.from(page[page.length - 1].seq).toString('base64url') : null,
    };
  }
}
