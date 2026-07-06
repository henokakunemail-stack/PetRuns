import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

// Jangan pernah return objek user penuh — passwordHash tidak boleh keluar dari API.
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  profilePhotoUrl: true,
  address: true,
  latitude: true,
  longitude: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: PUBLIC_USER_SELECT,
    });
  }
}
