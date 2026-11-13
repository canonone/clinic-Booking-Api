import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ErrorSchema } from '../../../common/schemas/error.schema';
import { BookingSchema } from '../schemas/booking.schema';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn('text')
  key: string;

  @Column({ name: 'body_hash', type: 'text' })
  bodyHash: string;

  /** 0 while the first request is still in flight. */
  @Column('int')
  status: number;

  /** The response to replay; null until the first request finishes. */
  @Column({ type: 'jsonb', nullable: true })
  response: BookingSchema | ErrorSchema | null;
}
