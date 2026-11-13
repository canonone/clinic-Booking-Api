import { SlotSchema } from '../schemas/slot.schema';

export class SlotDto implements Partial<SlotSchema> {
  id?: string;
  provider?: string;
  start?: string;
  end?: string;
}

/** Body of POST /reset. */
export class ResetDto {
  slots?: Array<SlotDto | null>;
}
