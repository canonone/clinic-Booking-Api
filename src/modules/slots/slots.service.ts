import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Slot } from './entities/slot.entity';
import { ResetDto } from './dto/reset.dto';
import { SlotWithAvailabilitySchema } from './schemas/slot.schema';
import { isValidSlot, toSlotEntity } from './utils/slot.util';
import {
  DAY_MS,
  DEMO_DAYS,
  DEMO_FIRST_SLOT_HOUR_UTC,
  DEMO_PROVIDERS,
  DEMO_SLOT_MINUTES,
  DEMO_SLOTS_PER_DAY,
  MINUTE_MS,
} from '../../common/utils/constants';

@Injectable()
export class SlotsService implements OnModuleInit {
  constructor(
    @InjectRepository(Slot) private slots: Repository<Slot>,
    private dataSource: DataSource,
  ) {}

  /** Demo data so a fresh database has something to book. Safe if several instances boot at once. */
  async onModuleInit() {
    if ((await this.slots.count()) > 0) return;
    const slotMs = DEMO_SLOT_MINUTES * MINUTE_MS;
    const base = new Date();
    base.setUTCHours(DEMO_FIRST_SLOT_HOUR_UTC, 0, 0, 0);
    const rows: Slot[] = [];
    let n = 1;
    for (let d = 1; d <= DEMO_DAYS; d++)
      for (const provider of DEMO_PROVIDERS)
        for (let h = 0; h < DEMO_SLOTS_PER_DAY; h++) {
          const start = new Date(base.getTime() + d * DAY_MS + h * slotMs);
          const end = new Date(start.getTime() + slotMs);
          rows.push(toSlotEntity({ id: `s${n++}`, provider, start: start.toISOString(), end: end.toISOString() }));
        }
    await this.slots.createQueryBuilder().insert().values(rows).orIgnore().execute();
  }

  /** Deletes every booking and replaces all slots with the ones sent. */
  async reset(body: ResetDto) {
    const slots = body?.slots;
    if (!Array.isArray(slots)) throw new BadRequestException('slots must be an array');
    const ids = new Set<string>();
    const rows = slots.map((s) => {
      if (!isValidSlot(s)) throw new BadRequestException('each slot needs id, provider, start and end (ISO date-times)');
      if (ids.has(s.id)) throw new BadRequestException(`duplicate slot id ${s.id}`);
      ids.add(s.id);
      return toSlotEntity(s);
    });
    await this.dataSource.transaction(async (m) => {
      await m.query('TRUNCATE bookings, idempotency_keys, booking_attempts, slots');
      if (rows.length) await m.insert(Slot, rows);
    });
    return {};
  }

  /** Every slot, earliest start first, optionally for one provider. */
  async list(provider?: string): Promise<{ slots: SlotWithAvailabilitySchema[] }> {
    const rows = await this.slots
      .createQueryBuilder('s')
      .select(['s.id', 's.provider', 's.startRaw', 's.endRaw'])
      .addSelect(`NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')`, 'available')
      .where(provider === undefined ? '1=1' : 's.provider = :provider', { provider })
      .orderBy('s.startAt')
      .addOrderBy('s.id')
      .getRawMany();
    return { slots: rows.map((r) => ({ id: r.s_id, provider: r.s_provider, start: r.s_start_raw, end: r.s_end_raw, available: r.available })) };
  }
}
