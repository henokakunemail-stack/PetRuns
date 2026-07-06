import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

export interface RequestingUser {
  id: string;
  role: string[];
}

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByOwner(ownerId: string, requester: RequestingUser) {
    this.assertOwnerOrAdmin(ownerId, requester);
    return this.prisma.pet.findMany({
      where: { ownerId, deletedAt: null },
      include: { species: true, breed: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, requester: RequestingUser) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, deletedAt: null },
      include: { species: true, breed: true },
    });
    if (!pet) throw new NotFoundException('Hewan tidak ditemukan');
    this.assertOwnerOrAdmin(pet.ownerId, requester);
    return pet;
  }

  /** ownerId selalu diambil dari token requester — tidak pernah dari body request. */
  create(ownerId: string, dto: CreatePetDto) {
    return this.prisma.pet.create({
      data: {
        ownerId,
        speciesId: dto.speciesId!,
        breedId: dto.breedId,
        name: dto.name,
        ageMonths: dto.ageMonths ?? 0,
        weightKg: dto.weightKg,
        temperamentNotes: dto.temperamentNotes,
        medicalNotes: dto.medicalNotes,
        photoUrl: dto.photoUrl,
      },
      include: { species: true, breed: true },
    });
  }

  async update(id: string, dto: UpdatePetDto, requester: RequestingUser) {
    await this.findById(id, requester); // throws kalau tidak ada / bukan miliknya
    return this.prisma.pet.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.speciesId !== undefined && { speciesId: dto.speciesId }),
        ...(dto.breedId !== undefined && { breedId: dto.breedId }),
        ...(dto.ageMonths !== undefined && { ageMonths: dto.ageMonths }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.temperamentNotes !== undefined && { temperamentNotes: dto.temperamentNotes }),
        ...(dto.medicalNotes !== undefined && { medicalNotes: dto.medicalNotes }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
      include: { species: true, breed: true },
    });
  }

  async softDelete(id: string, requester: RequestingUser) {
    await this.findById(id, requester); // throws kalau tidak ada / bukan miliknya
    return this.prisma.pet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private assertOwnerOrAdmin(ownerId: string, requester: RequestingUser): void {
    if (requester.id !== ownerId && !requester.role.includes('ADMIN')) {
      throw new ForbiddenException('Anda tidak berhak mengakses data hewan ini');
    }
  }
}
