import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { calculateAverageRating } from './lib/rating.util';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(bookingId: string, ownerId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: { review: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }
    if (booking.ownerId !== ownerId) {
      throw new ForbiddenException('Anda tidak berhak memberi rating untuk booking ini');
    }
    if (booking.status !== 'completed') {
      throw new BadRequestException('Booking harus berstatus completed sebelum bisa diberi rating');
    }
    if (booking.review) {
      throw new BadRequestException('Booking ini sudah pernah diberi rating');
    }

    const review = await this.prisma.review.create({
      data: { bookingId, rating: dto.rating, comment: dto.comment },
    });

    await this.recalculateWorkerRating(booking.workerProfileId);

    return review;
  }

  async listForWorker(workerProfileId: string) {
    return this.prisma.review.findMany({
      where: { booking: { workerProfileId } },
      include: {
        booking: { select: { id: true, scheduledStart: true, owner: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recalculateWorkerRating(workerProfileId: string): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      where: { booking: { workerProfileId } },
      select: { rating: true },
    });
    const averageRating = calculateAverageRating(reviews.map((r) => r.rating));

    await this.prisma.workerProfile.update({
      where: { id: workerProfileId },
      data: { averageRating },
    });
  }
}
