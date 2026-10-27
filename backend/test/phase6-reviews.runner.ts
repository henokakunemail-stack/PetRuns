import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewService,
  sanitizeReviewComment,
} from '../src/services/review.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { HttpError } from '../src/services/otp.service.ts';

describe('Phase 6: Reviews, Ratings, and Cache Management', () => {
  it('Task 37 & 38: Review submission sanitizes comment, validates 1-5 score, enforces COMPLETED status and evicts Redis cache', async () => {
    const redis = new InMemoryRedisClient();
    const workerId = 'worker-rev-1';
    const cacheKey = `worker:profile:${workerId}`;

    // Seed profile in Redis cache
    await redis.set(cacheKey, JSON.stringify({ id: workerId, ratingAvg: 4.5 }), 'EX', 300);
    assert.ok(await redis.get(cacheKey));

    let reviewInserted = false;
    let existingReviewCount = 0;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, owner_id, worker_id, status FROM bookings')) {
          return [
            {
              id: 'book-rev-1',
              owner_id: 'owner-rev-1',
              worker_id: workerId,
              status: 'COMPLETED',
            },
          ];
        }
        if (queryText.includes('SELECT id FROM reviews WHERE booking_id')) {
          return existingReviewCount > 0 ? [{ id: 'rev-existing-1' }] : [];
        }
        if (queryText.includes('INSERT INTO reviews')) {
          reviewInserted = true;
          existingReviewCount++;
          return [
            {
              id: 'rev-uuid-1',
              booking_id: p[0],
              owner_id: p[1],
              worker_id: p[2],
              score: p[3],
              comment: p[4],
              created_at: new Date(),
            },
          ];
        }
        return [];
      },
    });

    const reviewService = new ReviewService(mockDb, redis);

    // 1. Comment sanitization test
    const rawComment = '  <script>alert("hack")</script> Sangat ramah & tepat waktu!\n\n  ';
    const cleaned = sanitizeReviewComment(rawComment);
    assert.equal(cleaned, 'alert("hack") Sangat ramah & tepat waktu!');

    // 2. Submit valid 5-star review
    const review = await reviewService.submitReview({
      bookingId: 'book-rev-1',
      ownerId: 'owner-rev-1',
      score: 5,
      comment: rawComment,
    });

    assert.equal(review.score, 5);
    assert.equal(review.workerId, workerId);
    assert.equal(reviewInserted, true);

    // 3. Redis worker profile cache must be invalidated/evicted
    const cachedAfter = await redis.get(cacheKey);
    assert.equal(cachedAfter, null);

    // 4. Duplicate review on same booking is rejected (HTTP 409)
    await assert.rejects(
      async () => {
        await reviewService.submitReview({
          bookingId: 'book-rev-1',
          ownerId: 'owner-rev-1',
          score: 4,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).statusCode, 409);
        return true;
      }
    );

    // 5. Invalid score (< 1 or > 5 or non-integer) is rejected (HTTP 400)
    await assert.rejects(
      async () => {
        await reviewService.submitReview({
          bookingId: 'book-rev-1',
          ownerId: 'owner-rev-1',
          score: 6,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).statusCode, 400);
        return true;
      }
    );
  });

  it('Task 39: Pending review query returns unreviewed completed bookings', async () => {
    const redis = new InMemoryRedisClient();
    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('WHERE b.owner_id = $1 AND b.status = \'COMPLETED\' AND r.id IS NULL')) {
          return [
            {
              booking_id: 'book-unreviewed-1',
              worker_id: 'worker-pending-1',
              worker_name: 'Budi Santoso',
              completed_at: new Date(),
            },
          ];
        }
        return [];
      },
    });

    const reviewService = new ReviewService(mockDb, redis);
    const pending = await reviewService.getPendingReview('owner-unreviewed-1');

    assert.ok(pending);
    assert.equal(pending!.bookingId, 'book-unreviewed-1');
    assert.equal(pending!.workerName, 'Budi Santoso');
  });
});
