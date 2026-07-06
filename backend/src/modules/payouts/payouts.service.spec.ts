import { NotFoundException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';

function makeDeps() {
  const prisma = {
    workerProfile: { findUnique: jest.fn() },
    payout: { create: jest.fn(), findMany: jest.fn() },
  };
  return { prisma };
}

describe('PayoutsService.create', () => {
  it('menolak kalau worker profile tidak ditemukan', async () => {
    const { prisma } = makeDeps();
    prisma.workerProfile.findUnique.mockResolvedValue(null);
    const service = new PayoutsService(prisma as any);

    await expect(service.create({ workerProfileId: 'worker-1', amount: 100000 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('mencatat payout berstatus processed', async () => {
    const { prisma } = makeDeps();
    prisma.workerProfile.findUnique.mockResolvedValue({ id: 'worker-1' });
    prisma.payout.create.mockResolvedValue({
      id: 'payout-1',
      workerProfileId: 'worker-1',
      amount: 100000,
      status: 'processed',
    });
    const service = new PayoutsService(prisma as any);

    const result = await service.create({ workerProfileId: 'worker-1', amount: 100000 });

    expect(prisma.payout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workerProfileId: 'worker-1',
          amount: 100000,
          status: 'processed',
        }),
      }),
    );
    expect(result.status).toBe('processed');
  });
});

describe('PayoutsService.listForWorker', () => {
  it('mengembalikan daftar payout terurut terbaru dulu', async () => {
    const { prisma } = makeDeps();
    prisma.payout.findMany.mockResolvedValue([{ id: 'payout-2' }, { id: 'payout-1' }]);
    const service = new PayoutsService(prisma as any);

    const result = await service.listForWorker('worker-1');

    expect(prisma.payout.findMany).toHaveBeenCalledWith({
      where: { workerProfileId: 'worker-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(2);
  });
});
