import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBreedDto } from './dto/create-breed.dto';

@Injectable()
export class BreedsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(speciesId?: string) {
    return this.prisma.breed.findMany({
      where: speciesId ? { speciesId } : undefined,
      include: { species: true },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateBreedDto) {
    return this.prisma.breed.create({ data: dto });
  }
}
