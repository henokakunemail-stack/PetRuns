import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  pet: { findFirst: jest.Mock };
  workerProfile: { findUnique: jest.Mock; findMany: jest.Mock };
  booking: {
    findMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

function makePrismaMock(): MockPrisma {
  return {
    pet: { findFirst: jest.fn() },
    workerProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

// Senin = UTC day 1. Worker tersedia Senin 09:00-17:00.
const AVAILABILITY = [
  {
    dayOfWeek: 1,
    startTime: new Date('2000-01-01T09:00:00.000Z'),
    endTime: new Date('2000-01-01T17:00:00.000Z'),
  },
];

function nextMondayAt(hour: number): Date {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  const day = d.getUTCDay();
  const daysUntilMonday = (1 - day + 7) % 7 || 7; // pastikan selalu di masa depan
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}

describe('BookingsService.createBooking', () => {
  let prisma: MockPrisma;
  let config: ConfigService;
  let service: BookingsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    config = { get: jest.fn().mockReturnValue('20') } as unknown as ConfigService;
    service = new BookingsService(prisma as unknown as PrismaService, config);
  });

  const basePet = { id: 'pet-1', ownerId: 'owner-1', deletedAt: null };
  const baseWorkerProfile = {
    id: 'worker-profile-1',
    verificationStatus: 'approved',
    pricing: [{ durationMinutes: 60, price: 100_000 }],
    availability: AVAILABILITY,
  };

  it('berhasil membuat booking & menghitung komisi dengan benar', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue(baseWorkerProfile);
    prisma.booking.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'booking-1', ...data }),
    );

    const scheduledStart = nextMondayAt(10).toISOString();
    const result = await service.createBooking('owner-1', {
      workerProfileId: 'worker-profile-1',
      petId: 'pet-1',
      scheduledStart,
      durationMinutes: 60,
    });

    expect(result.priceTotal).toBe(100_000);
    expect(result.platformCommission).toBe(20_000);
    expect(result.workerPayout).toBe(80_000);
    expect(result.status).toBe('pending');
  });

  it('menolak kalau pet bukan milik owner', async () => {
    prisma.pet.findFirst.mockResolvedValue(null);

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: nextMondayAt(10).toISOString(),
        durationMinutes: 60,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak kalau worker belum diverifikasi', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue({
      ...baseWorkerProfile,
      verificationStatus: 'pending',
    });

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: nextMondayAt(10).toISOString(),
        durationMinutes: 60,
      }),
    ).rejects.toThrow('belum terverifikasi');
  });

  it('menolak kalau worker tidak menyediakan durasi yang diminta', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue(baseWorkerProfile);

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: nextMondayAt(10).toISOString(),
        durationMinutes: 90, // tidak ada di pricing
      }),
    ).rejects.toThrow('tidak menyediakan durasi');
  });

  it('menolak jadwal di luar jam ketersediaan worker', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue(baseWorkerProfile);

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: nextMondayAt(20).toISOString(), // jam 20:00, di luar 09-17
        durationMinutes: 60,
      }),
    ).rejects.toThrow('di luar jam ketersediaan');
  });

  it('menolak kalau bentrok dengan booking lain di jam yang sama', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue(baseWorkerProfile);
    const scheduledStart = nextMondayAt(10);
    prisma.booking.findMany.mockResolvedValue([
      { scheduledStart, durationMinutes: 60, status: 'accepted' },
    ]);

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: scheduledStart.toISOString(),
        durationMinutes: 60,
      }),
    ).rejects.toThrow('sudah punya booking lain');
  });

  it('menolak scheduledStart di masa lalu', async () => {
    prisma.pet.findFirst.mockResolvedValue(basePet);
    prisma.workerProfile.findUnique.mockResolvedValue(baseWorkerProfile);

    await expect(
      service.createBooking('owner-1', {
        workerProfileId: 'worker-profile-1',
        petId: 'pet-1',
        scheduledStart: new Date('2020-01-01T10:00:00.000Z').toISOString(),
        durationMinutes: 60,
      }),
    ).rejects.toThrow('masa lalu');
  });
});

describe('BookingsService permission resolution (updateStatus)', () => {
  let prisma: MockPrisma;
  let service: BookingsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    const config = { get: jest.fn().mockReturnValue('20') } as unknown as ConfigService;
    service = new BookingsService(prisma as unknown as PrismaService, config);
  });

  const booking = {
    id: 'booking-1',
    ownerId: 'owner-1',
    status: 'pending',
    workerProfile: { userId: 'worker-user-1' },
  };

  it('worker bisa accept booking miliknya', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);
    prisma.booking.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...booking, ...data }),
    );

    const result = await service.updateStatus(
      'booking-1',
      { status: 'accepted' },
      { id: 'worker-user-1', role: ['WORKER'] },
    );
    expect(result.status).toBe('accepted');
  });

  it('user yang tidak terkait booking ditolak', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.updateStatus(
        'booking-1',
        { status: 'accepted' },
        { id: 'random-user', role: ['OWNER'] },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('owner tidak bisa accept booking sendiri (state machine menolak)', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.updateStatus('booking-1', { status: 'accepted' }, { id: 'owner-1', role: ['OWNER'] }),
    ).rejects.toThrow('Transisi status booking tidak valid');
  });

  it('admin bisa cancel booking siapa pun', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);
    prisma.booking.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...booking, ...data }),
    );

    const result = await service.updateStatus(
      'booking-1',
      { status: 'cancelled' },
      { id: 'admin-1', role: ['ADMIN'] },
    );
    expect(result.status).toBe('cancelled');
  });
});
