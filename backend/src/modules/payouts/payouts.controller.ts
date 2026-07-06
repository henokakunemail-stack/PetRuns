import { Controller, Get, HttpCode, HttpStatus, Param, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('Payouts')
@ApiBearerAuth('access-token')
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly service: PayoutsService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePayoutDto) {
    return this.service.create(dto);
  }

  @Get('worker/:workerProfileId')
  @Roles('ADMIN')
  listForWorker(@Param('workerProfileId') workerProfileId: string) {
    return this.service.listForWorker(workerProfileId);
  }
}
