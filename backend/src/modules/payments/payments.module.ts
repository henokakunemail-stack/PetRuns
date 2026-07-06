import { Module } from '@nestjs/common';

import { MidtransPaymentAdapter } from './adapters/midtrans-payment.adapter';
import { PAYMENT_GATEWAY_ADAPTER } from './adapters/payment-gateway.adapter';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_GATEWAY_ADAPTER, useClass: MidtransPaymentAdapter },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
