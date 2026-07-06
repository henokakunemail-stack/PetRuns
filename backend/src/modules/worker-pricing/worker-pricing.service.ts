import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetPricingDto } from './dto/set-pricing.dto';

@Injectable()
export class WorkerPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async listForWorker(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];

    return this.prisma.workerPricing.findMany({
      where: { workerProfileId: profile.id },
      orderBy: { durationMinutes: 'asc' },
    });
  }

  async replaceAll(userId: string, dto: SetPricingDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new Error('Profil worker belum dibuat — POST /worker-profiles/register');

    await this.prisma.$transaction([
      this.prisma.workerPricing.deleteMany({ where: { workerProfileId: profile.id } }),
      this.prisma.workerPricing.createMany({
        data: dto.items.map((item) => ({
          workerProfileId: profile.id,
          durationMinutes: item.durationMinutes,
          price: item.price,
        })),
      }),
    ]);

    return this.listForWorker(userId);
  }
}
