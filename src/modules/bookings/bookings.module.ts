import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingAttempt } from './entities/booking-attempt.entity';
import { Booking } from './entities/booking.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, IdempotencyKey, BookingAttempt])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
