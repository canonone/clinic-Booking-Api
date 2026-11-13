import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ResetDto } from './dto/reset.dto';
import { SlotsService } from './slots.service';

@Controller()
@UseGuards(ApiKeyGuard)
export class SlotsController {
  constructor(private slots: SlotsService) {}

  @Post('reset')
  @HttpCode(200)
  reset(@Body() body: ResetDto) {
    return this.slots.reset(body);
  }

  @Get('slots')
  list(@Query('provider') provider?: string) {
    return this.slots.list(typeof provider === 'string' ? provider : undefined);
  }
}
