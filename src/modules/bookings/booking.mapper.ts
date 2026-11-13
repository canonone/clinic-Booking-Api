import { BookingSchema } from './schemas/booking.schema';
import { Booking } from './entities/booking.entity';

export const toBooking = (b: Booking): BookingSchema => ({
  id: b.id,
  slot_id: b.slotId,
  name: b.name,
  email: b.email,
  status: b.status,
  created_at: new Date(b.createdAt).toISOString(),
});
