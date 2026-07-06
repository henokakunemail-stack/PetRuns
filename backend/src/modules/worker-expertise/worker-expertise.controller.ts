import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkerExpertiseService } from './worker-expertise.service';
import { SetExpertiseDto } from './dto/set-expertise.dto';

@ApiTags('Worker Expertise')
@ApiBearerAuth('access-token')
@Controller('expertise')
export class WorkerExpertiseController {
  constructor(private readonly service: WorkerExpertiseService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.service.listForWorker(userId);
  }

  @Put()
  replace(@CurrentUser('id') userId: string, @Body() dto: SetExpertiseDto) {
    return this.service.replaceAll(userId, dto);
  }
}
