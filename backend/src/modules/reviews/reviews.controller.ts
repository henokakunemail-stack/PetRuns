import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post('bookings/:bookingId/review')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.service.create(bookingId, ownerId, dto);
  }

  @Get('worker-profiles/:workerProfileId/reviews')
  listForWorker(@Param('workerProfileId') workerProfileId: string) {
    return this.service.listForWorker(workerProfileId);
  }
}
