import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchWorkersDto } from './dto/search-workers.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { matchWorkers, WorkerCandidate } from './lib/matching.util';
import { calculateCommissionBreakdown } from './lib/pricing.util';
import { Actor, assertValidTransition, BookingStatus } from './lib/booking-status.util';

interface RequestingUser {
  id: string;
  role: string[];
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getCommissionPercent(): number {
    const raw = this.config.get<string>('PLATFORM_COMMISSION_PERCENT');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : 20; // default 20% kalau env tidak diset
  }

  async searchWorkers(dto: SearchWorkersDto) {
    const profiles = await this.prisma.workerProfile.findMany({
      where: {
        verificationStatus: 'approved',
        speciesExpertise: { some: { speciesId: dto.speciesId } },
      },
      include: {
        user: { select: { id: true, name: true, profilePhotoUrl: true } },
        pricing: { where: { durationMinutes: dto.durationMinutes } },
      },
    });

    const candidates: WorkerCandidate[] = profiles.map((p) => ({
      id: p.id,
      baseLatitude: p.baseLatitude ? Number(p.baseLatitude) : null,
      baseLongitude: p.baseLongitude ? Number(p.baseLongitude) : null,
      serviceRadiusKm: p.serviceRadiusKm ? Number(p.serviceRadiusKm) : null,
      averageRating: p.averageRating ? Number(p.averageRating) : null,
      priceForRequestedDuration: p.pricing[0] ? Number(p.pricing[0].price) : null,
    }));

    const matched = matchWorkers(candidates, {
      ownerLatitude: dto.latitude,
      ownerLongitude: dto.longitude,
      maxPrice: dto.maxPrice,
      minRating: dto.minRating,
    });

    if (dto.sortBy === 'price') {
      matched.sort(
        (a, b) => (a.priceForRequestedDuration ?? 0) - (b.priceForRequestedDuration ?? 0),
      );
    } else if (dto.sortBy === 'rating') {
      matched.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    }
    // default: sudah terurut by distance dari matchWorkers()

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    return matched.map((m) => {
      const profile = profileById.get(m.id)!;
      return {
        workerProfileId: m.id,
        distanceKm: Math.round(m.distanceKm * 10) / 10,
        price: m.priceForRequestedDuration,
        averageRating: m.averageRating,
        user: profile.user,
        serviceRadiusKm: m.serviceRadiusKm,
      };
    });
  }

  async createBooking(ownerId: string, dto: CreateBookingDto) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: dto.petId, ownerId, deletedAt: null },
    });
    if (!pet) {
      throw new BadRequestException('Hewan tidak ditemukan atau bukan milik Anda');
    }

    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerProfileId },
      include: { pricing: true, availability: true },
    });
    if (!workerProfile || workerProfile.verificationStatus !== 'approved') {
      throw new BadRequestException('Worker tidak ditemukan atau belum terverifikasi');
    }

    const pricingEntry = workerProfile.pricing.find(
      (p) => p.durationMinutes === dto.durationMinutes,
    );
    if (!pricingEntry) {
      throw new BadRequestException(
        `Worker ini tidak menyediakan durasi ${dto.durationMinutes} menit`,
      );
    }

    const scheduledStart = new Date(dto.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      throw new BadRequestException('scheduledStart tidak valid');
    }
    if (scheduledStart.getTime() < Date.now()) {
      throw new BadRequestException('scheduledStart tidak boleh di masa lalu');
    }

    this.assertWithinAvailability(workerProfile.availability, scheduledStart);
    await this.assertNoOverlap(dto.workerProfileId, scheduledStart, dto.durationMinutes);

    const { priceTotal, platformCommission, workerPayout } = calculateCommissionBreakdown(
      Number(pricingEntry.price),
      this.getCommissionPercent(),
    );

    return this.prisma.booking.create({
      data: {
        ownerId,
        workerProfileId: dto.workerProfileId,
        petId: dto.petId,
        scheduledStart,
        durationMinutes: dto.durationMinutes,
        priceTotal,
        platformCommission,
        workerPayout,
        status: 'pending',
        ownerNotes: dto.ownerNotes,
      },
      include: {
        pet: true,
        // select terbatas — jangan pernah include user penuh (bocorin passwordHash)
        workerProfile: {
          include: {
            user: { select: { id: true, name: true, phone: true, profilePhotoUrl: true } },
          },
        },
      },
    });
  }

  private assertWithinAvailability(
    availability: { dayOfWeek: number; startTime: Date; endTime: Date }[],
    scheduledStart: Date,
  ): void {
    if (availability.length === 0) {
      throw new BadRequestException('Worker belum mengatur jadwal ketersediaan');
    }

    const dayOfWeek = scheduledStart.getUTCDay();
    const minutesOfDay = scheduledStart.getUTCHours() * 60 + scheduledStart.getUTCMinutes();

    const fits = availability.some((slot) => {
      if (slot.dayOfWeek !== dayOfWeek) return false;
      const startMinutes = slot.startTime.getUTCHours() * 60 + slot.startTime.getUTCMinutes();
      const endMinutes = slot.endTime.getUTCHours() * 60 + slot.endTime.getUTCMinutes();
      return minutesOfDay >= startMinutes && minutesOfDay < endMinutes;
    });

    if (!fits) {
      throw new BadRequestException('Jadwal yang dipilih di luar jam ketersediaan worker');
    }
  }

  private async assertNoOverlap(
    workerProfileId: string,
    scheduledStart: Date,
    durationMinutes: number,
  ): Promise<void> {
    const newEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
    // Ambil kandidat booking aktif di hari yang sama (window generous +/- 1 hari) lalu cek overlap presisi di JS.
    const windowStart = new Date(scheduledStart.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(scheduledStart.getTime() + 24 * 60 * 60_000);

    const candidates = await this.prisma.booking.findMany({
      where: {
        workerProfileId,
        status: { in: ['pending', 'accepted', 'in_progress'] },
        scheduledStart: { gte: windowStart, lte: windowEnd },
      },
    });

    const hasOverlap = candidates.some((b) => {
      const existingEnd = new Date(b.scheduledStart.getTime() + b.durationMinutes * 60_000);
      return b.scheduledStart < newEnd && scheduledStart < existingEnd;
    });

    if (hasOverlap) {
      throw new BadRequestException('Worker sudah punya booking lain di jam tersebut');
    }
  }

  async listForOwner(ownerId: string) {
    return this.prisma.booking.findMany({
      where: { ownerId, deletedAt: null },
      include: {
        pet: true,
        workerProfile: {
          include: {
            user: { select: { id: true, name: true, phone: true, profilePhotoUrl: true } },
          },
        },
        review: true,
      },
      orderBy: { scheduledStart: 'desc' },
    });
  }

  async listForWorker(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    return this.prisma.booking.findMany({
      where: { workerProfileId: profile.id, deletedAt: null },
      include: { pet: true, owner: { select: { id: true, name: true, phone: true } } },
      orderBy: { scheduledStart: 'desc' },
    });
  }

  async listAllForAdmin(status?: string) {
    return this.prisma.booking.findMany({
      where: { deletedAt: null, ...(status ? { status } : {}) },
      include: {
        pet: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
        workerProfile: { include: { user: { select: { id: true, name: true } } } },
        payment: true,
      },
      orderBy: { scheduledStart: 'desc' },
    });
  }

  async getById(id: string, requester: RequestingUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        pet: true,
        owner: { select: { id: true, name: true, phone: true } },
        workerProfile: { include: { user: { select: { id: true, name: true, phone: true } } } },
        payment: true,
        review: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan');

    this.resolveActor(
      { ownerId: booking.ownerId, workerUserId: booking.workerProfile.userId },
      requester,
    ); // throws ForbiddenException kalau tidak berhak lihat
    return booking;
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto, requester: RequestingUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { workerProfile: { select: { userId: true } } },
    });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan');

    const actor = this.resolveActor(
      { ownerId: booking.ownerId, workerUserId: booking.workerProfile.userId },
      requester,
    );
    assertValidTransition(booking.status as BookingStatus, dto.status, actor);

    const extra: Record<string, Date> = {};
    if (dto.status === 'in_progress') extra.actualStart = new Date();
    if (dto.status === 'completed') extra.actualEnd = new Date();

    return this.prisma.booking.update({
      where: { id },
      data: { status: dto.status, ...extra },
      include: {
        pet: true,
        // select terbatas — jangan pernah include user penuh (bocorin passwordHash)
        workerProfile: {
          include: {
            user: { select: { id: true, name: true, phone: true, profilePhotoUrl: true } },
          },
        },
      },
    });
  }

  /** Tentukan peran requester terhadap booking ini (OWNER/WORKER/ADMIN), atau throw kalau tidak berhak sama sekali. */
  private resolveActor(
    booking: { ownerId: string; workerUserId: string },
    requester: RequestingUser,
  ): Actor {
    if (requester.role.includes('ADMIN')) return 'ADMIN';
    if (booking.ownerId === requester.id) return 'OWNER';
    if (booking.workerUserId === requester.id) return 'WORKER';
    throw new ForbiddenException('Anda tidak berhak mengakses booking ini');
  }
}
