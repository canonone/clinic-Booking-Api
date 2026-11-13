import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonErrorFilter } from './common/filters/json-error.filter';
import { typeOrmConfig } from './database/typeorm.config';
import { SlotsModule } from './slots/slots.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [TypeOrmModule.forRootAsync({ useFactory: typeOrmConfig }), SlotsModule, BookingsModule],
  providers: [{ provide: APP_FILTER, useClass: JsonErrorFilter }],
})
export class AppModule {}
