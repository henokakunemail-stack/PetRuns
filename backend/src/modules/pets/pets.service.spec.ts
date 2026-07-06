import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PetsService } from './pets.service';

function makeDeps() {
  const prisma = {
    pet: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { prisma };
}

const owner = { id: 'owner-1', role: ['OWNER'] };
const otherUser = { id: 'owner-lain', role: ['OWNER'] };
const admin = { id: 'admin-1', role: ['ADMIN'] };

describe('PetsService — otorisasi kepemilikan', () => {
  it('menolak list pet milik orang lain', () => {
    const { prisma } = makeDeps();
    const service = new PetsService(prisma as any);

    expect(() => service.findAllByOwner('owner-1', otherUser)).toThrow(ForbiddenException);
  });

  it('admin boleh list pet siapa pun', async () => {
    const { prisma } = makeDeps();
    prisma.pet.findMany.mockResolvedValue([]);
    const service = new PetsService(prisma as any);

    await expect(service.findAllByOwner('owner-1', admin)).resolves.toEqual([]);
  });

  it('menolak update pet milik orang lain', async () => {
    const { prisma } = makeDeps();
    prisma.pet.findFirst.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    const service = new PetsService(prisma as any);

    await expect(service.update('pet-1', { name: 'Hacked' }, otherUser)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });

  it('menolak delete pet yang tidak ditemukan', async () => {
    const { prisma } = makeDeps();
    prisma.pet.findFirst.mockResolvedValue(null);
    const service = new PetsService(prisma as any);

    await expect(service.softDelete('pet-x', owner)).rejects.toThrow(NotFoundException);
  });

  it('create selalu memakai ownerId dari token, bukan dari body', async () => {
    const { prisma } = makeDeps();
    prisma.pet.create.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    const service = new PetsService(prisma as any);

    await service.create('owner-1', { name: 'Bruno', speciesId: 'species-1' } as any);

    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'owner-1' }) }),
    );
  });

  it('owner boleh update pet miliknya sendiri', async () => {
    const { prisma } = makeDeps();
    prisma.pet.findFirst.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    prisma.pet.update.mockResolvedValue({ id: 'pet-1', name: 'Bruno Baru' });
    const service = new PetsService(prisma as any);

    const result = await service.update('pet-1', { name: 'Bruno Baru' }, owner);

    expect(result.name).toBe('Bruno Baru');
  });
});
