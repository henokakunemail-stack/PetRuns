import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER, PaymentGatewayAdapter } from './adapters/payment-gateway.adapter';
import { mapMidtransTransactionStatus } from './lib/midtrans-status.util';
import { MidtransNotificationPayload } from './payments.types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER) private readonly gateway: PaymentGatewayAdapter,
  ) {}

  async createPaymentForBooking(bookingId: string, ownerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: { owner: true, payment: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }
    if (booking.ownerId !== ownerId) {
      throw new ForbiddenException('Anda tidak berhak membayar booking ini');
    }
    if (booking.payment?.status === 'paid') {
      throw new BadRequestException('Booking ini sudah dibayar');
    }

    let gatewayRef: string;
    let redirectUrl: string;
    try {
      ({ gatewayRef, redirectUrl } = await this.gateway.createTransaction({
        orderId: booking.id,
        grossAmount: Number(booking.priceTotal),
        customerName: booking.owner.name,
        customerEmail: booking.owner.email ?? undefined,
      }));
    } catch (err) {
      // Detail error (termasuk respons Midtrans) hanya masuk log server — jangan bocorkan ke klien.
      this.logger.error(`Gagal membuat transaksi Midtrans untuk booking ${booking.id}`, err);
      throw new BadGatewayException(
        'Gagal menghubungi payment gateway — coba lagi, atau hubungi admin jika berulang',
      );
    }

    const payment = await this.prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        amount: booking.priceTotal,
        paymentMethod: 'midtrans_snap',
        paymentGatewayRef: gatewayRef,
        status: 'pending',
      },
      update: {
        paymentGatewayRef: gatewayRef,
        status: 'pending',
      },
    });

    return { payment, redirectUrl };
  }

  async handleNotification(payload: MidtransNotificationPayload) {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } =
      payload;
    if (!order_id || !status_code || !gross_amount || !signature_key || !transaction_status) {
      throw new BadRequestException('Payload notifikasi Midtrans tidak lengkap');
    }

    const isValid = this.gateway.verifyNotificationSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });
    if (!isValid) {
      throw new ForbiddenException('Signature notifikasi Midtrans tidak valid');
    }

    const payment = await this.prisma.payment.findUnique({ where: { bookingId: order_id } });
    if (!payment) {
      throw new NotFoundException('Payment untuk booking ini tidak ditemukan');
    }

    const status = mapMidtransTransactionStatus(transaction_status, fraud_status);
    const transactionId = payload.transaction_id ? String(payload.transaction_id) : undefined;

    return this.prisma.payment.update({
      where: { bookingId: order_id },
      data: {
        status,
        ...(transactionId ? { paymentGatewayRef: transactionId } : {}),
      },
    });
  }
}
