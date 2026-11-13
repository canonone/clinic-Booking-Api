import { ErrorSchema } from '../../common/schemas/error.schema';

/** Body of POST /bookings. */
export interface NewBookingSchema {
  slot_id: string;
  name: string;
  email: string;
}

export interface BookingSchema {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
}

export interface BookingPageSchema {
  bookings: BookingSchema[];
  next_cursor: string | null;
}

/** What the booking flow produces: an HTTP status and the JSON body to send (also stored for idempotent replays). */
export interface BookingResult {
  status: number;
  body: BookingSchema | ErrorSchema;
}
