import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateBreedDto } from './dto/create-breed.dto';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit — data master, hampir tidak pernah berubah

const cacheKey = (speciesId?: string) => `breeds:${speciesId ?? 'all'}`;

@Injectable()
export class BreedsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(speciesId?: string) {
    const key = cacheKey(speciesId);
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const breeds = await this.prisma.breed.findMany({
      where: speciesId ? { speciesId } : undefined,
      include: { species: true },
      orderBy: { name: 'asc' },
    });
    await this.cache.set(key, breeds, CACHE_TTL_MS);
    return breeds;
  }

  async create(dto: CreateBreedDto) {
    const created = await this.prisma.breed.create({ data: dto });
    await Promise.all([this.cache.del(cacheKey()), this.cache.del(cacheKey(dto.speciesId))]);
    return created;
  }
}
