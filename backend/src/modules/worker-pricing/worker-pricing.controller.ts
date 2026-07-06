import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkerPricingService } from './worker-pricing.service';
import { SetPricingDto } from './dto/set-pricing.dto';

@ApiTags('Worker Pricing')
@ApiBearerAuth('access-token')
@Controller('pricing')
export class WorkerPricingController {
  constructor(private readonly service: WorkerPricingService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.service.listForWorker(userId);
  }

  @Put()
  replace(@CurrentUser('id') userId: string, @Body() dto: SetPricingDto) {
    return this.service.replaceAll(userId, dto);
  }
}
