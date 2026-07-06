import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

function makeDeps() {
  const prisma = {
    booking: { findFirst: jest.fn() },
    payment: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const gateway = {
    createTransaction: jest.fn(),
    verifyNotificationSignature: jest.fn(),
  };
  return { prisma, gateway };
}

describe('PaymentsService.createPaymentForBooking', () => {
  it('menolak kalau booking tidak ditemukan', async () => {
    const { prisma, gateway } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue(null);
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.createPaymentForBooking('booking-1', 'owner-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('menolak kalau bukan owner booking tersebut', async () => {
    const { prisma, gateway } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-lain',
      priceTotal: 100000,
      owner: { name: 'Budi', email: 'budi@example.com' },
      payment: null,
    });
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.createPaymentForBooking('booking-1', 'owner-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('menolak kalau booking sudah lunas', async () => {
    const { prisma, gateway } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-1',
      priceTotal: 100000,
      owner: { name: 'Budi', email: 'budi@example.com' },
      payment: { status: 'paid' },
    });
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.createPaymentForBooking('booking-1', 'owner-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('berhasil membuat transaksi Midtrans & menyimpan payment pending', async () => {
    const { prisma, gateway } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-1',
      priceTotal: 100000,
      owner: { name: 'Budi', email: 'budi@example.com' },
      payment: null,
    });
    gateway.createTransaction.mockResolvedValue({
      gatewayRef: 'snap-token-abc',
      redirectUrl: 'https://app.sandbox.midtrans.com/snap/v1/redirect/abc',
    });
    prisma.payment.upsert.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      status: 'pending',
      paymentGatewayRef: 'snap-token-abc',
    });
    const service = new PaymentsService(prisma as any, gateway as any);

    const result = await service.createPaymentForBooking('booking-1', 'owner-1');

    expect(gateway.createTransaction).toHaveBeenCalledWith({
      orderId: 'booking-1',
      grossAmount: 100000,
      customerName: 'Budi',
      customerEmail: 'budi@example.com',
    });
    expect(result.redirectUrl).toBe('https://app.sandbox.midtrans.com/snap/v1/redirect/abc');
    expect(result.payment.status).toBe('pending');
  });
});

describe('PaymentsService.handleNotification', () => {
  const basePayload = {
    order_id: 'booking-1',
    status_code: '200',
    gross_amount: '100000.00',
    signature_key: 'valid-signature',
    transaction_status: 'settlement',
  };

  it('menolak payload yang tidak lengkap', async () => {
    const { prisma, gateway } = makeDeps();
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.handleNotification({ ...basePayload, order_id: '' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('menolak signature yang tidak valid', async () => {
    const { prisma, gateway } = makeDeps();
    gateway.verifyNotificationSignature.mockReturnValue(false);
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.handleNotification(basePayload)).rejects.toThrow(ForbiddenException);
  });

  it('menolak kalau payment untuk booking tidak ditemukan', async () => {
    const { prisma, gateway } = makeDeps();
    gateway.verifyNotificationSignature.mockReturnValue(true);
    prisma.payment.findUnique.mockResolvedValue(null);
    const service = new PaymentsService(prisma as any, gateway as any);

    await expect(service.handleNotification(basePayload)).rejects.toThrow(NotFoundException);
  });

  it('update status payment sesuai mapping transaction_status', async () => {
    const { prisma, gateway } = makeDeps();
    gateway.verifyNotificationSignature.mockReturnValue(true);
    prisma.payment.findUnique.mockResolvedValue({ bookingId: 'booking-1', status: 'pending' });
    prisma.payment.update.mockResolvedValue({ bookingId: 'booking-1', status: 'paid' });
    const service = new PaymentsService(prisma as any, gateway as any);

    const result = await service.handleNotification(basePayload);

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      data: { status: 'paid' },
    });
    expect(result.status).toBe('paid');
  });
});
