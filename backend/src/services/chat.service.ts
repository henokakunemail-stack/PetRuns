import { dbClient, DatabaseClient, type QueryResultRow } from '../db/client.ts';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { encryptField, decryptField } from '../security/encryption.ts';
import { HttpError } from './otp.service.ts';

export interface ChatRoom {
  id: string;
  bookingId: string | null;
  ownerId: string;
  workerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

export interface SendMessageOptions {
  roomId: string;
  senderId: string;
  text: string;
}

export interface GetMessagesOptions {
  roomId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

export class ChatService {
  private db: DatabaseClient;
  private redis: IRedisClient;

  constructor(db: DatabaseClient = dbClient, redis: IRedisClient = redisClient) {
    this.db = db;
    this.redis = redis;
  }

  async getOrCreateRoom(ownerId: string, workerId: string, bookingId?: string | null): Promise<ChatRoom> {
    if (!ownerId || !workerId) {
      throw new HttpError('Owner ID and Worker ID are required to open a chat room', 400);
    }

    if (ownerId === workerId) {
      throw new HttpError('Cannot create a chat room with oneself', 400);
    }

    // Check if room already exists
    const query = bookingId
      ? `SELECT id, booking_id, owner_id, worker_id, created_at, updated_at
         FROM chat_rooms
         WHERE owner_id = $1 AND worker_id = $2 AND booking_id = $3`
      : `SELECT id, booking_id, owner_id, worker_id, created_at, updated_at
         FROM chat_rooms
         WHERE owner_id = $1 AND worker_id = $2 AND booking_id IS NULL`;

    const params = bookingId ? [ownerId, workerId, bookingId] : [ownerId, workerId];
    const existing = await this.db.query(query, params);

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        id: String(row.id),
        bookingId: row.booking_id ? String(row.booking_id) : null,
        ownerId: String(row.owner_id),
        workerId: String(row.worker_id),
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
      };
    }

    // Insert new room
    const insertQuery = `
      INSERT INTO chat_rooms (booking_id, owner_id, worker_id, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, booking_id, owner_id, worker_id, created_at, updated_at
    `;

    const created = await this.db.query(insertQuery, [bookingId ?? null, ownerId, workerId]);
    const row = created.rows[0];

    return {
      id: String(row.id),
      bookingId: row.booking_id ? String(row.booking_id) : null,
      ownerId: String(row.owner_id),
      workerId: String(row.worker_id),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  async sendMessage(options: SendMessageOptions): Promise<ChatMessage> {
    const { roomId, senderId, text } = options;

    if (!text || text.trim().length === 0) {
      throw new HttpError('Message content cannot be empty', 400);
    }

    // 1. Verify room exists and sender is participant
    const roomCheck = await this.db.query(
      'SELECT id, owner_id, worker_id FROM chat_rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      throw new HttpError('Chat room not found', 404);
    }

    const room = roomCheck.rows[0];
    if (room.owner_id !== senderId && room.worker_id !== senderId) {
      throw new HttpError('Forbidden: you are not a participant of this chat room', 403);
    }

    // 2. Encrypt message content with AES-256-GCM
    const encryptedContent = await encryptField(text.trim());

    // 3. Insert message
    const insertQuery = `
      INSERT INTO chat_messages (room_id, sender_id, content_encrypted, is_read, created_at)
      VALUES ($1, $2, $3, FALSE, NOW())
      RETURNING id, room_id, sender_id, is_read, created_at
    `;

    const msgRes = await this.db.query(insertQuery, [roomId, senderId, encryptedContent]);
    const msgRow = msgRes.rows[0];

    // Update room updated_at
    await this.db.query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [roomId]);

    const message: ChatMessage = {
      id: String(msgRow.id),
      roomId: String(msgRow.room_id),
      senderId: String(msgRow.sender_id),
      content: text.trim(),
      isRead: false,
      createdAt: new Date(String(msgRow.created_at)),
    };

    // 4. Publish real-time notification to Redis buffer for WebSocket dispatch
    await this.redis.rpush(
      `chat:stream:${roomId}`,
      JSON.stringify({
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })
    );

    return message;
  }

  async getMessages(options: GetMessagesOptions): Promise<ChatMessage[]> {
    const { roomId, userId, limit = 50, offset = 0 } = options;

    // 1. Verify user is participant
    const roomCheck = await this.db.query(
      'SELECT id, owner_id, worker_id FROM chat_rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      throw new HttpError('Chat room not found', 404);
    }

    const room = roomCheck.rows[0];
    if (room.owner_id !== userId && room.worker_id !== userId) {
      throw new HttpError('Forbidden: you are not a participant of this chat room', 403);
    }

    // 2. Mark incoming messages as read
    await this.db.query(
      `UPDATE chat_messages
       SET is_read = TRUE
       WHERE room_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [roomId, userId]
    );

    // 3. Fetch messages
    const fetchQuery = `
      SELECT id, room_id, sender_id, content_encrypted, is_read, created_at
      FROM chat_messages
      WHERE room_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const res = await this.db.query(fetchQuery, [roomId, limit, offset]);

    // 4. Decrypt content transparently
    const decryptedMessages: ChatMessage[] = [];
    for (const row of res.rows) {
      const plaintext = await decryptField(String(row.content_encrypted));
      decryptedMessages.push({
        id: String(row.id),
        roomId: String(row.room_id),
        senderId: String(row.sender_id),
        content: plaintext,
        isRead: Boolean(row.is_read),
        createdAt: new Date(String(row.created_at)),
      });
    }

    return decryptedMessages;
  }
}

export const chatService = new ChatService();
