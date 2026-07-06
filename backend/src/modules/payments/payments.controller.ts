import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { MidtransNotificationPayload } from './payments.types';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @ApiBearerAuth('access-token')
  @Post('bookings/:bookingId/payment')
  @HttpCode(HttpStatus.CREATED)
  createPayment(@Param('bookingId') bookingId: string, @CurrentUser('id') ownerId: string) {
    return this.service.createPaymentForBooking(bookingId, ownerId);
  }

  @Public()
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() payload: MidtransNotificationPayload) {
    return this.service.handleNotification(payload);
  }
}
