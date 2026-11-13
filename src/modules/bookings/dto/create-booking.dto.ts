import { NewBookingSchema } from '../schemas/booking.schema';

/**
 * Body of POST /bookings. Every field is optional here on purpose: the service validates
 * the body itself (so bad requests still count toward rate limits and idempotency replays).
 */
export class CreateBookingDto implements Partial<NewBookingSchema> {
  slot_id?: string;
  name?: string;
  email?: string;
}
