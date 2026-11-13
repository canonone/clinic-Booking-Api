import { Column, Entity, Generated, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

export type BookingStatus = 'confirmed' | 'cancelled';

// The real double-booking guarantee: at most one confirmed booking per slot, enforced by the DB.
@Index('one_confirmed_per_slot', ['slotId'], { unique: true, where: `"status" = 'confirmed'` })
@Entity('bookings')
export class Booking extends AbstractEntity {
  /** Insertion order, used as the pagination cursor. bigint comes back from pg as a string. */
  @Column({ type: 'bigint' })
  @Generated('increment')
  seq: string;

  @Column({ name: 'slot_id', type: 'text' })
  slotId: string;

  @Column('text')
  name: string;

  @Column('text')
  email: string;

  @Column({ type: 'text' })
  status: BookingStatus;
}
