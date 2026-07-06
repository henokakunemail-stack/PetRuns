import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkerProfileService } from './worker-profile.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';

@ApiTags('Worker Profiles')
@ApiBearerAuth('access-token')
@Controller('worker-profiles')
export class WorkerProfileController {
  constructor(private readonly service: WorkerProfileService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@CurrentUser('id') userId: string, @Body() dto: RegisterWorkerDto) {
    return this.service.register(userId, dto);
  }

  @Get('me')
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.service.getMe(userId);
  }

  @Patch('me')
  updateMyProfile(@CurrentUser('id') userId: string, @Body() dto: RegisterWorkerDto) {
    return this.service.update(userId, dto);
  }

  @Get('admin/pending')
  @Roles('ADMIN')
  listPendingVerification() {
    return this.service.listPendingVerification();
  }

  @Get('admin/all')
  @Roles('ADMIN')
  listAll(@Query('status') status?: string) {
    return this.service.listAll(status);
  }

  @Patch(':id/verification')
  @Roles('ADMIN')
  setVerificationStatus(@Param('id') id: string, @Body() dto: UpdateVerificationDto) {
    return this.service.setVerificationStatus(id, dto);
  }

  @Get(':id')
  getProfileById(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
