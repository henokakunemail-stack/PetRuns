import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BookingsService } from './bookings.service';
import { SearchWorkersDto } from './dto/search-workers.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get('search-workers')
  searchWorkers(@Query() dto: SearchWorkersDto) {
    return this.service.searchWorkers(dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(ownerId, dto);
  }

  @Get('me/owner')
  listMineAsOwner(@CurrentUser('id') ownerId: string) {
    return this.service.listForOwner(ownerId);
  }

  @Get('me/worker')
  listMineAsWorker(@CurrentUser('id') userId: string) {
    return this.service.listForWorker(userId);
  }

  @Get('admin/all')
  @Roles('ADMIN')
  listAllForAdmin(@Query('status') status?: string) {
    return this.service.listAllForAdmin(status);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: { id: string; role: string[] }) {
    return this.service.getById(id, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: { id: string; role: string[] },
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}
