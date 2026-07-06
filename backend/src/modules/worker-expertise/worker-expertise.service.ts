import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetExpertiseDto } from './dto/set-expertise.dto';

@Injectable()
export class WorkerExpertiseService {
  constructor(private readonly prisma: PrismaService) {}

  async listForWorker(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];

    return this.prisma.workerSpeciesExpertise.findMany({
      where: { workerProfileId: profile.id },
      include: { species: true },
    });
  }

  async replaceAll(userId: string, dto: SetExpertiseDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new Error('Profil worker belum dibuat — POST /worker-profiles/register');

    await this.prisma.$transaction([
      this.prisma.workerSpeciesExpertise.deleteMany({
        where: { workerProfileId: profile.id },
      }),
      this.prisma.workerSpeciesExpertise.createMany({
        data: dto.speciesIds.map((speciesId) => ({
          workerProfileId: profile.id,
          speciesId,
        })),
      }),
    ]);

    return this.listForWorker(userId);
  }
}
