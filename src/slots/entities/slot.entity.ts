import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('slots')
export class Slot {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  provider: string;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  /** The timestamps exactly as the client sent them, echoed back unchanged. */
  @Column({ name: 'start_raw', type: 'text' })
  startRaw: string;

  @Column({ name: 'end_raw', type: 'text' })
  endRaw: string;
}
