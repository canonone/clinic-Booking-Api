import { SlotDto } from '../dto/reset.dto';
import { Slot } from '../entities/slot.entity';
import { SlotSchema } from '../schemas/slot.schema';

/** True when the slot has a non-empty id, a provider and parseable start/end date-times. */
export const isValidSlot = (s: SlotDto | null): s is SlotSchema =>
  !!s && typeof s.id === 'string' && !!s.id && typeof s.provider === 'string' &&
  typeof s.start === 'string' && !isNaN(Date.parse(s.start)) &&
  typeof s.end === 'string' && !isNaN(Date.parse(s.end));

/** Builds the entity, keeping the original start/end strings alongside the parsed timestamps. */
export const toSlotEntity = (s: SlotSchema): Slot =>
  Object.assign(new Slot(), { id: s.id, provider: s.provider, startAt: new Date(s.start), endAt: new Date(s.end), startRaw: s.start, endRaw: s.end });
