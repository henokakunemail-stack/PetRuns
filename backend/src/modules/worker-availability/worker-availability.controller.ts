import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkerAvailabilityService } from './worker-availability.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';

@ApiTags('Worker Availability')
@ApiBearerAuth('access-token')
@Controller('availability')
export class WorkerAvailabilityController {
  constructor(private readonly service: WorkerAvailabilityService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.service.listForWorker(userId);
  }

  @Put()
  replace(@CurrentUser('id') userId: string, @Body() dto: SetAvailabilityDto) {
    return this.service.replaceAll(userId, dto);
  }
}
