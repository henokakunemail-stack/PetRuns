import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { dbClient, DatabaseClient, type QueryResultRow } from '../db/client.ts';
import { decryptField } from '../security/encryption.ts';
import { HttpError } from './otp.service.ts';
import type { SupportedPetType } from './pricing.service.ts';

export interface LocationPingPayload {
  workerId: string;
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
}

export interface WorkerCardProfile {
  id: string;
  fullName: string;
  bio: string | null;
  ratingAvg: number;
  ratingCount: number;
  price30m: number;
  price60m: number;
  price120m: number;
  priceOvernight: number;
  supportedPetTypes: string[];
  isOnline: boolean;
  distanceKm?: number;
}

export interface NearbyWorkersQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  petType?: SupportedPetType;
}

export class GeolocationService {
  private redis: IRedisClient;
  private db: DatabaseClient;

  constructor(redis: IRedisClient = redisClient, db: DatabaseClient = dbClient) {
    this.redis = redis;
    this.db = db;
  }

  async pingLocation(payload: LocationPingPayload): Promise<{ success: boolean; recordedAt: Date }> {
    const { workerId, latitude, longitude, accuracy } = payload;

    if (!workerId) {
      throw new HttpError('Worker ID is required', 400);
    }

    // 1. Validate coordinates
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new HttpError('Invalid latitude or longitude coordinates', 400);
    }

    // 2. Reject GPS pings with accuracy > 50 meters
    if (typeof accuracy !== 'number' || accuracy > 50) {
      throw new HttpError(
        `GPS accuracy of ${accuracy}m is too low. Maximum allowed accuracy is 50 meters.`,
        400
      );
    }

    // 3. Verify worker status: must be VERIFIED
    const workerCheck = await this.db.query(
      'SELECT verification_status FROM worker_profiles WHERE id = $1',
      [workerId]
    );

    if (workerCheck.rows.length === 0) {
      throw new HttpError('Worker profile not found', 404);
    }

    const verificationStatus = workerCheck.rows[0].verification_status;
    if (verificationStatus !== 'VERIFIED') {
      throw new HttpError('Worker must be VERIFIED to submit live location pings', 403);
    }

    const now = new Date();

    // 4. Update PostgreSQL PostGIS current_location & last_location_at
    await this.db.query(
      `UPDATE worker_profiles
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
           last_location_at = $3,
           is_online = true
       WHERE id = $4`,
      [longitude, latitude, now, workerId]
    );

    // 5. Update Redis GEO key 'workers:active:geo' with 120-second presence key
    await this.redis.geoadd('workers:active:geo', longitude, latitude, workerId);
    await this.redis.set(`worker:presence:${workerId}`, '1', 'EX', 120);

    return {
      success: true,
      recordedAt: now,
    };
  }

  async evictStaleWorkers(): Promise<{ evictedCount: number; evictedIds: string[] }> {
    // 1. Query PostgreSQL for workers whose last ping is older than 60 seconds
    const staleResult = await this.db.query(
      `SELECT id FROM worker_profiles
       WHERE is_online = true
         AND last_location_at < NOW() - INTERVAL '60 seconds'`
    );

    const evictedIds: string[] = staleResult.rows.map((row) => String(row.id));

    if (evictedIds.length > 0) {
      // 2. Update PostgreSQL is_online = false
      await this.db.query(
        `UPDATE worker_profiles
         SET is_online = false
         WHERE id = ANY($1::uuid[])`,
        [evictedIds]
      );

      // 3. Evict from Redis GEO sorted set
      for (const id of evictedIds) {
        await this.redis.zrem('workers:active:geo', id);
        await this.redis.del(`worker:presence:${id}`);
      }
    }

    return {
      evictedCount: evictedIds.length,
      evictedIds,
    };
  }

  async getWorkerCardProfile(workerId: string): Promise<WorkerCardProfile | null> {
    const cacheKey = `cache:worker:${workerId}`;

    // 1. Check Redis cache hit
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as WorkerCardProfile;
      } catch {
        // Continue to DB on corrupt cache
      }
    }

    // 2. Cache miss: Query DB with transparent PII decryption
    const query = `
      SELECT wp.id,
             u.full_name_encrypted,
             wp.bio,
             wp.rating_avg,
             wp.rating_count,
             wp.price_30m,
             wp.price_60m,
             wp.price_120m,
             wp.price_overnight,
             wp.supported_pet_types,
             wp.is_online
      FROM worker_profiles wp
      JOIN users u ON u.id = wp.id
      WHERE wp.id = $1
    `;

    const res = await this.db.query(query, [workerId]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const fullName = await decryptField(String(row.full_name_encrypted || ''));

    // Exclude any sensitive PII (KTP, phone, raw docs)
    const cardProfile: WorkerCardProfile = {
      id: String(row.id),
      fullName,
      bio: row.bio ? String(row.bio) : null,
      ratingAvg: Number(row.rating_avg || 5.0),
      ratingCount: Number(row.rating_count || 0),
      price30m: Number(row.price_30m || 0),
      price60m: Number(row.price_60m || 0),
      price120m: Number(row.price_120m || 0),
      priceOvernight: Number(row.price_overnight || 0),
      supportedPetTypes: (row.supported_pet_types as string[]) || [],
      isOnline: Boolean(row.is_online),
    };

    // 3. Cache in Redis with 300-second TTL
    await this.redis.set(cacheKey, JSON.stringify(cardProfile), 'EX', 300);

    return cardProfile;
  }

  async discoverNearbyWorkers(query: NearbyWorkersQuery): Promise<WorkerCardProfile[]> {
    const { latitude, longitude, petType } = query;
    let radiusKm = query.radiusKm ?? 5;

    // Validate coordinates
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new HttpError('Invalid search coordinates', 400);
    }

    // Cap radius at max 15km
    if (radiusKm > 15) {
      radiusKm = 15;
    }
    if (radiusKm <= 0) {
      radiusKm = 5;
    }

    // 1. Query Redis GEOSEARCH BYRADIUS
    const radiusMeters = radiusKm * 1000;
    const geoMatches = await this.redis.geosearch(
      'workers:active:geo',
      longitude,
      latitude,
      radiusMeters
    );

    if (geoMatches.length === 0) {
      return [];
    }

    // 2. Fetch profiles via cache-aside service
    const profiles: WorkerCardProfile[] = [];
    for (const match of geoMatches) {
      const profile = await this.getWorkerCardProfile(match.member);
      if (profile && profile.isOnline) {
        profile.distanceKm = Math.round((match.distance / 1000) * 100) / 100;

        // 3. Filter by petType if requested
        if (petType) {
          if (profile.supportedPetTypes.includes(petType)) {
            profiles.push(profile);
          }
        } else {
          profiles.push(profile);
        }
      }
    }

    // 4. Return sorted by distance ascending
    profiles.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return profiles;
  }
}

export const geolocationService = new GeolocationService();
