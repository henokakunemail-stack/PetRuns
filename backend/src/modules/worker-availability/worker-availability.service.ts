import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';

@Injectable()
export class WorkerAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listForWorker(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];

    return this.prisma.workerAvailability.findMany({
      where: { workerProfileId: profile.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async replaceAll(userId: string, dto: SetAvailabilityDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new Error('Profil worker belum dibuat — POST /worker-profiles/register');

    // Convert HH:mm strings to ISO date strings for Prisma Time fields
    const entries = dto.items.map((item) => {
      const toDate = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return new Date(
          `2000-01-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`,
        );
      };
      return {
        workerProfileId: profile.id,
        dayOfWeek: item.dayOfWeek,
        startTime: toDate(item.startTime),
        endTime: toDate(item.endTime),
      };
    });

    await this.prisma.$transaction([
      this.prisma.workerAvailability.deleteMany({ where: { workerProfileId: profile.id } }),
      this.prisma.workerAvailability.createMany({
        data: entries,
      }),
    ]);

    return this.listForWorker(userId);
  }
}
