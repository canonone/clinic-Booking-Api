import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Fields most entities share. Extend it instead of repeating them:
 *   @Entity('things') export class Thing extends AbstractEntity { ... }
 * Not for tables whose id is chosen by the client (e.g. Slot) or that have a natural key.
 */
export abstract class AbstractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** Refreshed by TypeORM on every save/update (e.g. when a booking is cancelled). */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
