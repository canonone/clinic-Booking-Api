import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('booking_attempts')
export class BookingAttempt {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column('text')
  email: string;

  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  at: Date;
}
