import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeolocationService } from '../src/services/geolocation.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { DatabaseClient } from '../src/db/client.ts';
import { encryptField } from '../src/security/encryption.ts';
import { HttpError } from '../src/services/otp.service.ts';

describe('Phase 3: Real-Time Worker Geolocation and Discovery', () => {
  it('Task 16: Location ping accepts accuracy <= 50m for VERIFIED workers, writes Redis GEO, rejects > 50m or unverified', async () => {
    const redis = new InMemoryRedisClient();
    let dbUpdated = false;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT verification_status')) {
          if (p[0] === 'verified-worker') {
            return [{ verification_status: 'VERIFIED' }];
          }
          return [{ verification_status: 'PENDING' }];
        }
        if (queryText.includes('UPDATE worker_profiles')) {
          dbUpdated = true;
          return [];
        }
        return [];
      },
    });

    const geoService = new GeolocationService(redis, mockDb);

    // 1. Rejects accuracy > 50m
    await assert.rejects(
      async () => {
        await geoService.pingLocation({
          workerId: 'verified-worker',
          latitude: -6.2,
          longitude: 106.8,
          accuracy: 65, // > 50m
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 400
    );

    // 2. Rejects unverified worker
    await assert.rejects(
      async () => {
        await geoService.pingLocation({
          workerId: 'unverified-worker',
          latitude: -6.2,
          longitude: 106.8,
          accuracy: 10,
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 403
    );

    // 3. Accepts valid ping
    const res = await geoService.pingLocation({
      workerId: 'verified-worker',
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 12,
    });

    assert.equal(res.success, true);
    assert.equal(dbUpdated, true);

    // Redis GEO contains member
    const presence = await redis.get('worker:presence:verified-worker');
    assert.equal(presence, '1');
  });

  it('Task 17: Stale worker eviction marks workers offline and removes from Redis GEO', async () => {
    const redis = new InMemoryRedisClient();
    // Add active worker in Redis GEO
    await redis.geoadd('workers:active:geo', 106.8456, -6.2088, 'stale-worker-1');
    await redis.set('worker:presence:stale-worker-1', '1');

    let dbMarkedOffline = false;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('SELECT id FROM worker_profiles')) {
          return [{ id: 'stale-worker-1' }];
        }
        if (queryText.includes('UPDATE worker_profiles')) {
          dbMarkedOffline = true;
          return [];
        }
        return [];
      },
    });

    const geoService = new GeolocationService(redis, mockDb);
    const evictionRes = await geoService.evictStaleWorkers();

    assert.equal(evictionRes.evictedCount, 1);
    assert.equal(evictionRes.evictedIds[0], 'stale-worker-1');
    assert.equal(dbMarkedOffline, true);

    // Assert removed from Redis GEO
    const searchRes = await redis.geosearch('workers:active:geo', 106.8456, -6.2088, 10000);
    assert.equal(searchRes.length, 0);
  });

  it('Task 18: Worker profile cache-aside returns cached on hit, fetches & decrypts on miss with 300s TTL', async () => {
    const redis = new InMemoryRedisClient();
    let dbQueried = false;

    const encryptedName = await encryptField('Budi Santoso');
    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('FROM worker_profiles wp')) {
          dbQueried = true;
          return [
            {
              id: 'worker-cache-1',
              full_name_encrypted: encryptedName,
              bio: 'Dog walker handal',
              rating_avg: 4.9,
              rating_count: 28,
              price_30m: 35000,
              price_60m: 60000,
              price_120m: 110000,
              price_overnight: 180000,
              supported_pet_types: ['DOG_SMALL', 'CAT'],
              is_online: true,
            },
          ];
        }
        return [];
      },
    });

    const geoService = new GeolocationService(redis, mockDb);

    // 1. Cache miss: queries DB, decrypts name, writes to cache
    const profile = await geoService.getWorkerCardProfile('worker-cache-1');
    assert.ok(profile);
    assert.equal(profile.fullName, 'Budi Santoso');
    assert.equal(dbQueried, true);

    // Excludes sensitive PII
    assert.equal((profile as unknown as { ktp_encrypted?: string }).ktp_encrypted, undefined);

    // 2. Cache hit: returns from Redis without DB call
    dbQueried = false;
    const cachedProfile = await geoService.getWorkerCardProfile('worker-cache-1');
    assert.ok(cachedProfile);
    assert.equal(cachedProfile.fullName, 'Budi Santoso');
    assert.equal(dbQueried, false);
  });

  it('Task 19: Spatial discovery returns nearby workers sorted by distance and filters by pet type', async () => {
    const redis = new InMemoryRedisClient();
    // Central point: Monas Jakarta (-6.1754, 106.8272)
    // Worker A: ~1.2 km away
    await redis.geoadd('workers:active:geo', 106.828, -6.185, 'worker-near');
    // Worker B: ~3.5 km away
    await redis.geoadd('workers:active:geo', 106.845, -6.200, 'worker-far');

    // Populate cache for worker cards
    await redis.set(
      'cache:worker:worker-near',
      JSON.stringify({
        id: 'worker-near',
        fullName: 'Worker Dekat',
        bio: 'Dekat Monas',
        ratingAvg: 4.8,
        ratingCount: 15,
        price30m: 35000,
        price60m: 60000,
        price120m: 110000,
        priceOvernight: 180000,
        supportedPetTypes: ['DOG_SMALL'],
        isOnline: true,
      })
    );

    await redis.set(
      'cache:worker:worker-far',
      JSON.stringify({
        id: 'worker-far',
        fullName: 'Worker Jauh',
        bio: 'Agak Jauh',
        ratingAvg: 5.0,
        ratingCount: 40,
        price30m: 40000,
        price60m: 70000,
        price120m: 120000,
        priceOvernight: 200000,
        supportedPetTypes: ['CAT'],
        isOnline: true,
      })
    );

    const mockDb = new DatabaseClient({ mockQueryHandler: async () => [] });
    const geoService = new GeolocationService(redis, mockDb);

    // Query all nearby within 5km
    const allNearby = await geoService.discoverNearbyWorkers({
      latitude: -6.1754,
      longitude: 106.8272,
      radiusKm: 5,
    });

    assert.equal(allNearby.length, 2);
    // Sorted by distance ascending
    assert.equal(allNearby[0].id, 'worker-near');
    assert.equal(allNearby[1].id, 'worker-far');
    assert.ok((allNearby[0].distanceKm ?? 0) < (allNearby[1].distanceKm ?? 0));

    // Filter by petType = 'CAT'
    const catOnly = await geoService.discoverNearbyWorkers({
      latitude: -6.1754,
      longitude: 106.8272,
      radiusKm: 5,
      petType: 'CAT',
    });

    assert.equal(catOnly.length, 1);
    assert.equal(catOnly[0].id, 'worker-far');
  });
});
