/** Query string of GET /bookings. Values arrive as raw strings and are validated in the service. */
export class ListBookingsQueryDto {
  email?: string;
  limit?: string;
  cursor?: string;
}
