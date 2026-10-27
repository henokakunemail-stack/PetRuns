import { dbClient, DatabaseClient } from '../db/client.ts';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { HttpError } from './otp.service.ts';

export interface SubmitReviewOptions {
  bookingId: string;
  ownerId: string;
  score: number;
  comment?: string;
}

export interface ReviewEntity {
  id: string;
  bookingId: string;
  ownerId: string;
  workerId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export interface PendingReviewBooking {
  bookingId: string;
  workerId: string;
  workerName: string;
  completedAt: Date;
}

export function sanitizeReviewComment(text?: string): string | null {
  if (!text) return null;
  // Strip HTML tags and normalize whitespace
  const sanitized = text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  return sanitized.length > 0 ? sanitized : null;
}

export class ReviewService {
  private db: DatabaseClient;
  private redis: IRedisClient;

  constructor(db: DatabaseClient = dbClient, redis: IRedisClient = redisClient) {
    this.db = db;
    this.redis = redis;
  }

  async submitReview(options: SubmitReviewOptions): Promise<ReviewEntity> {
    const { bookingId, ownerId, score, comment } = options;

    // 1. Validate score 1-5 integer
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new HttpError('Review score must be an integer between 1 and 5', 400);
    }

    const cleanComment = sanitizeReviewComment(comment);

    // 2. Fetch booking and verify ownership and completion status
    const bookingRes = await this.db.query(
      'SELECT id, owner_id, worker_id, status FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      throw new HttpError('Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    if (booking.owner_id !== ownerId) {
      throw new HttpError('Forbidden: you are not the owner for this booking', 403);
    }

    if (booking.status !== 'COMPLETED') {
      throw new HttpError(`Cannot review booking with status ${String(booking.status)}. Expected COMPLETED.`, 400);
    }

    // 3. Ensure booking does not already have a review (1 review per booking)
    const existingReview = await this.db.query(
      'SELECT id FROM reviews WHERE booking_id = $1',
      [bookingId]
    );

    if (existingReview.rows.length > 0) {
      throw new HttpError('Review already submitted for this booking', 409);
    }

    const workerId = String(booking.worker_id);

    // 4. Insert review
    const insertRes = await this.db.query(
      `INSERT INTO reviews (booking_id, owner_id, worker_id, score, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, booking_id, owner_id, worker_id, score, comment, created_at`,
      [bookingId, ownerId, workerId, score, cleanComment]
    );

    const created = insertRes.rows[0];

    // 5. Evict worker profile Redis cache key: worker:profile:{worker_id}
    const cacheKey = `worker:profile:${workerId}`;
    await this.redis.del(cacheKey);

    return {
      id: String(created.id),
      bookingId: String(created.booking_id),
      ownerId: String(created.owner_id),
      workerId: String(created.worker_id),
      score: Number(created.score),
      comment: (created.comment as string | null) ?? null,
      createdAt: (created.created_at as Date) || new Date(),
    };
  }

  async getPendingReview(ownerId: string): Promise<PendingReviewBooking | null> {
    const res = await this.db.query(
      `SELECT b.id as booking_id, b.worker_id, b.completed_at, u.full_name as worker_name
       FROM bookings b
       JOIN worker_profiles wp ON wp.id = b.worker_id
       JOIN users u ON u.id = wp.user_id
       LEFT JOIN reviews r ON r.booking_id = b.id
       WHERE b.owner_id = $1 AND b.status = 'COMPLETED' AND r.id IS NULL
       ORDER BY b.completed_at DESC
       LIMIT 1`,
      [ownerId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      bookingId: String(row.booking_id),
      workerId: String(row.worker_id),
      workerName: String(row.worker_name),
      completedAt: row.completed_at as Date,
    };
  }
}

export const reviewService = new ReviewService();
