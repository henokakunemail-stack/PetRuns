import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';

@Injectable()
export class WorkerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    return this.prisma.workerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        speciesExpertise: { include: { species: true } },
        pricing: { orderBy: { durationMinutes: 'asc' } },
        availability: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
  }

  async register(userId: string, dto: RegisterWorkerDto) {
    // Check if profile already exists
    const existing = await this.prisma.workerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new Error('Profil worker sudah ada — gunakan PUT /worker-profile/me untuk update');
    }

    const profile = await this.prisma.workerProfile.create({
      data: {
        userId,
        bio: dto.bio,
        ktpDocumentUrl: dto.ktpDocumentUrl,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        serviceRadiusKm: dto.serviceRadiusKm,
        baseLatitude: dto.baseLatitude,
        baseLongitude: dto.baseLongitude,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });
    return profile;
  }

  async update(userId: string, dto: RegisterWorkerDto) {
    return this.prisma.workerProfile.update({
      where: { userId },
      data: {
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.ktpDocumentUrl !== undefined && { ktpDocumentUrl: dto.ktpDocumentUrl }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber }),
        ...(dto.serviceRadiusKm !== undefined && { serviceRadiusKm: dto.serviceRadiusKm }),
        ...(dto.baseLatitude !== undefined && { baseLatitude: dto.baseLatitude }),
        ...(dto.baseLongitude !== undefined && { baseLongitude: dto.baseLongitude }),
      },
      include: {
        speciesExpertise: { include: { species: true } },
        pricing: { orderBy: { durationMinutes: 'asc' } },
        availability: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
  }

  async getById(id: string) {
    return this.prisma.workerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        speciesExpertise: { include: { species: true } },
        pricing: { orderBy: { durationMinutes: 'asc' } },
        availability: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
  }

  /** Admin only — daftar worker yang menunggu verifikasi (untuk approve/reject). */
  async listPendingVerification() {
    return this.prisma.workerProfile.findMany({
      where: { verificationStatus: 'pending' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Admin only — semua worker profile, filter opsional by status, untuk monitoring dashboard. */
  async listAll(status?: string) {
    return this.prisma.workerProfile.findMany({
      where: status ? { verificationStatus: status } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin only — approve/reject worker setelah cek dokumen KTP & rekening. */
  async setVerificationStatus(id: string, dto: UpdateVerificationDto) {
    const existing = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Worker profile tidak ditemukan');
    }
    return this.prisma.workerProfile.update({
      where: { id },
      data: {
        verificationStatus: dto.status,
        adminNote: dto.adminNote,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  }
}
