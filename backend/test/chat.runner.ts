import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../src/services/chat.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { HttpError } from '../src/services/otp.service.ts';

describe('Chat Feature: Owner & Worker Messaging', () => {
  it('Creates or retrieves chat room and rejects invalid participants', async () => {
    const redis = new InMemoryRedisClient();
    let createdRoom: QueryResultRow | null = null;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, booking_id, owner_id, worker_id')) {
          return createdRoom ? [createdRoom] : [];
        }
        if (queryText.includes('INSERT INTO chat_rooms')) {
          createdRoom = {
            id: 'room-123',
            booking_id: p[0],
            owner_id: p[1],
            worker_id: p[2],
            created_at: new Date(),
            updated_at: new Date(),
          };
          return [createdRoom];
        }
        return [];
      },
    });

    const chat = new ChatService(mockDb, redis);

    // 1. Same user cannot chat with themselves
    await assert.rejects(
      async () => {
        await chat.getOrCreateRoom('user-1', 'user-1');
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 400
    );

    // 2. Create room between owner and worker
    const room = await chat.getOrCreateRoom('owner-uuid', 'worker-uuid');
    assert.equal(room.id, 'room-123');
    assert.equal(room.ownerId, 'owner-uuid');
    assert.equal(room.workerId, 'worker-uuid');

    // 3. Second call returns existing room
    const existing = await chat.getOrCreateRoom('owner-uuid', 'worker-uuid');
    assert.equal(existing.id, 'room-123');
  });

  it('Sends message with AES-256 encryption, publishes to Redis, and blocks outsiders', async () => {
    const redis = new InMemoryRedisClient();
    let storedMessageRow: QueryResultRow | null = null;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, owner_id, worker_id FROM chat_rooms')) {
          return [{ id: 'room-123', owner_id: 'owner-uuid', worker_id: 'worker-uuid' }];
        }
        if (queryText.includes('INSERT INTO chat_messages')) {
          storedMessageRow = {
            id: 'msg-999',
            room_id: p[0],
            sender_id: p[1],
            content_encrypted: p[2],
            is_read: false,
            created_at: new Date(),
          };
          return [storedMessageRow];
        }
        return [];
      },
    });

    const chat = new ChatService(mockDb, redis);

    // 1. Outsider cannot send message to room
    await assert.rejects(
      async () => {
        await chat.sendMessage({
          roomId: 'room-123',
          senderId: 'outsider-user',
          text: 'Halo!',
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 403
    );

    // 2. Valid sender sends message
    const msg = await chat.sendMessage({
      roomId: 'room-123',
      senderId: 'owner-uuid',
      text: 'Halo mas, anjing saya Golden Retriever ya.',
    });

    assert.equal(msg.content, 'Halo mas, anjing saya Golden Retriever ya.');
    assert.equal(msg.senderId, 'owner-uuid');

    // Ensure database stores ONLY ciphertext, never plaintext
    assert.ok(storedMessageRow);
    assert.ok(typeof storedMessageRow.content_encrypted === 'string');
    assert.ok(!String(storedMessageRow.content_encrypted).includes('Golden Retriever'));

    // Ensure Redis stream receives event
    const stream = await redis.lrange('chat:stream:room-123', 0, -1);
    assert.equal(stream.length, 1);
    assert.ok(stream[0].includes('Golden Retriever'));
  });

  it('Gets messages with transparent decryption and marks unread as read', async () => {
    const redis = new InMemoryRedisClient();
    let messagesMarkedRead = false;

    // First send a message to get valid ciphertext
    const chatHelper = new ChatService(new DatabaseClient({ mockQueryHandler: async () => [] }), redis);
    const { encryptField } = await import('../src/security/encryption.ts');
    const ciphertext = await encryptField('Siap kak, sudah sampai depan rumah.');

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('SELECT id, owner_id, worker_id FROM chat_rooms')) {
          return [{ id: 'room-123', owner_id: 'owner-uuid', worker_id: 'worker-uuid' }];
        }
        if (queryText.includes('UPDATE chat_messages')) {
          messagesMarkedRead = true;
          return [];
        }
        if (queryText.includes('SELECT id, room_id, sender_id, content_encrypted')) {
          return [
            {
              id: 'msg-1',
              room_id: 'room-123',
              sender_id: 'worker-uuid',
              content_encrypted: ciphertext,
              is_read: false,
              created_at: new Date(),
            },
          ];
        }
        return [];
      },
    });

    const chat = new ChatService(mockDb, redis);

    // Owner reads worker's message
    const msgs = await chat.getMessages({
      roomId: 'room-123',
      userId: 'owner-uuid',
    });

    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].content, 'Siap kak, sudah sampai depan rumah.');
    assert.equal(messagesMarkedRead, true);

    // Outsider cannot read messages
    await assert.rejects(
      async () => {
        await chat.getMessages({
          roomId: 'room-123',
          userId: 'stranger-user',
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 403
    );
  });
});
