import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function makeDeps() {
  const prisma = {
    booking: { findFirst: jest.fn() },
    review: { create: jest.fn(), findMany: jest.fn() },
    workerProfile: { update: jest.fn() },
  };
  return { prisma };
}

describe('ReviewsService.create', () => {
  it('menolak kalau booking tidak ditemukan', async () => {
    const { prisma } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue(null);
    const service = new ReviewsService(prisma as any);

    await expect(service.create('booking-1', 'owner-1', { rating: 5 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('menolak kalau bukan owner booking tersebut', async () => {
    const { prisma } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-lain',
      status: 'completed',
      workerProfileId: 'worker-1',
      review: null,
    });
    const service = new ReviewsService(prisma as any);

    await expect(service.create('booking-1', 'owner-1', { rating: 5 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('menolak kalau booking belum completed', async () => {
    const { prisma } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-1',
      status: 'in_progress',
      workerProfileId: 'worker-1',
      review: null,
    });
    const service = new ReviewsService(prisma as any);

    await expect(service.create('booking-1', 'owner-1', { rating: 5 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('menolak kalau booking sudah pernah direview', async () => {
    const { prisma } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-1',
      status: 'completed',
      workerProfileId: 'worker-1',
      review: { id: 'review-existing' },
    });
    const service = new ReviewsService(prisma as any);

    await expect(service.create('booking-1', 'owner-1', { rating: 5 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('membuat review & recalculate averageRating worker', async () => {
    const { prisma } = makeDeps();
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      ownerId: 'owner-1',
      status: 'completed',
      workerProfileId: 'worker-1',
      review: null,
    });
    prisma.review.create.mockResolvedValue({
      id: 'review-1',
      bookingId: 'booking-1',
      rating: 5,
      comment: 'Sangat bagus',
    });
    prisma.review.findMany.mockResolvedValue([{ rating: 5 }, { rating: 3 }]);
    const service = new ReviewsService(prisma as any);

    const result = await service.create('booking-1', 'owner-1', {
      rating: 5,
      comment: 'Sangat bagus',
    });

    expect(prisma.review.create).toHaveBeenCalledWith({
      data: { bookingId: 'booking-1', rating: 5, comment: 'Sangat bagus' },
    });
    expect(prisma.workerProfile.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: { averageRating: 4 },
    });
    expect(result.id).toBe('review-1');
  });
});
