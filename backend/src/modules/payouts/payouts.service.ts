import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreatePayoutDto } from './dto/create-payout.dto';

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pencatatan payout dasar untuk MVP: admin trigger manual setelah transfer
   * dilakukan di luar sistem (lihat docs/EXECUTION_PLAN.md Fase C — belum ada
   * payout otomatis). Payout langsung dicatat berstatus 'processed'.
   */
  async create(dto: CreatePayoutDto) {
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerProfileId },
    });
    if (!workerProfile) {
      throw new NotFoundException('Worker profile tidak ditemukan');
    }

    return this.prisma.payout.create({
      data: {
        workerProfileId: dto.workerProfileId,
        amount: dto.amount,
        status: 'processed',
        processedAt: new Date(),
      },
    });
  }

  async listForWorker(workerProfileId: string) {
    return this.prisma.payout.findMany({
      where: { workerProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
