import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpeciesDto } from './dto/create-species.dto';

const CACHE_KEY = 'species:all';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit — data master, hampir tidak pernah berubah

@Injectable()
export class SpeciesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll() {
    const cached = await this.cache.get(CACHE_KEY);
    if (cached) return cached;

    const species = await this.prisma.species.findMany({ orderBy: { name: 'asc' } });
    await this.cache.set(CACHE_KEY, species, CACHE_TTL_MS);
    return species;
  }

  async create(dto: CreateSpeciesDto) {
    const created = await this.prisma.species.create({ data: dto });
    await this.cache.del(CACHE_KEY);
    return created;
  }
}
