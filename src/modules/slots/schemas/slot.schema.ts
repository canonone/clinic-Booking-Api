/** Slot, as sent to POST /reset. `start` / `end` are ISO date-times. */
export interface SlotSchema {
  id: string;
  provider: string;
  start: string;
  end: string;
}

/** Slot, as returned by GET /slots. `available` is false while the slot has a confirmed booking. */
export interface SlotWithAvailabilitySchema extends SlotSchema {
  available: boolean;
}
