import {
  workerProfileRepository,
  WorkerProfileRepository,
  type WorkerProfile,
} from '../repositories/worker-profile.repository.ts';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { HttpError } from './otp.service.ts';

export const ALLOWED_PET_TYPES = [
  'DOG_SMALL',
  'DOG_MEDIUM',
  'DOG_LARGE',
  'CAT',
  'OTHER',
] as const;

export type SupportedPetType = (typeof ALLOWED_PET_TYPES)[number];

export interface PricingCapabilitiesPayload {
  supportedPetTypes: SupportedPetType[];
  price30m: number;
  price60m: number;
  price120m: number;
  priceOvernight: number;
}

export class PricingService {
  private workerRepo: WorkerProfileRepository;
  private redis: IRedisClient;

  constructor(
    workerRepo: WorkerProfileRepository = workerProfileRepository,
    redis: IRedisClient = redisClient
  ) {
    this.workerRepo = workerRepo;
    this.redis = redis;
  }

  async getPricingCapabilities(workerId: string): Promise<PricingCapabilitiesPayload> {
    if (!workerId) {
      throw new HttpError('Worker ID is required', 400);
    }

    const profile = await this.workerRepo.findById(workerId);
    if (!profile) {
      throw new HttpError('Worker profile not found', 404);
    }

    return {
      supportedPetTypes: profile.supportedPetTypes as SupportedPetType[],
      price30m: profile.price30m,
      price60m: profile.price60m,
      price120m: profile.price120m,
      priceOvernight: profile.priceOvernight,
    };
  }

  async setPricingCapabilities(
    workerId: string,
    payload: PricingCapabilitiesPayload
  ): Promise<WorkerProfile> {
    if (!workerId) {
      throw new HttpError('Worker ID is required', 400);
    }

    const { supportedPetTypes, price30m, price60m, price120m, priceOvernight } = payload;

    // 1. Validate supported pet types enum
    if (!Array.isArray(supportedPetTypes) || supportedPetTypes.length === 0) {
      throw new HttpError('At least one supported pet type is required', 400);
    }

    for (const petType of supportedPetTypes) {
      if (!ALLOWED_PET_TYPES.includes(petType)) {
        throw new HttpError(
          `Invalid pet type: "${petType}". Allowed types: ${ALLOWED_PET_TYPES.join(', ')}`,
          400
        );
      }
    }

    // 2. Validate non-negative pricing numbers
    const prices = [
      { name: 'price30m', val: price30m },
      { name: 'price60m', val: price60m },
      { name: 'price120m', val: price120m },
      { name: 'priceOvernight', val: priceOvernight },
    ];

    for (const { name, val } of prices) {
      if (typeof val !== 'number' || isNaN(val) || val <= 0) {
        throw new HttpError(`Pricing tier "${name}" must be a positive number greater than 0`, 400);
      }
    }

    // 3. Update database
    const updated = await this.workerRepo.upsert({
      id: workerId,
      supportedPetTypes,
      price30m,
      price60m,
      price120m,
      priceOvernight,
    });

    // 4. Invalidate Redis cache keys immediately on update
    await this.redis.del(`cache:worker:${workerId}`, `worker:profile:${workerId}`);

    return updated;
  }
}

export const pricingService = new PricingService();
