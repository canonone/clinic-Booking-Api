import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

@Controller('bookings')
@UseGuards(ApiKeyGuard)
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post()
  async create(@Body() body: CreateBookingDto, @Headers('idempotency-key') key: string | undefined, @Res() res: Response) {
    const r = await this.bookings.create(body, key && key.trim() ? key.trim() : undefined);
    res.status(r.status).json(r.body);
  }

  @Get()
  list(@Query() query: ListBookingsQueryDto) {
    return this.bookings.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.bookings.cancel(id);
  }
}
