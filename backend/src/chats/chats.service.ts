import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { decideIdempotency } from '../common/security.helpers';
import type { PoolClient } from 'pg';

interface PublicUserRow { id: string; username: string; display_name: string; avatar_id?: string; avatar_type?: string }
interface MessageRow { id: string; client_message_id: string; chat_id: string; sender_id: string; text: string; created_at: Date | string; delivered_at: Date | string | null }
type PublicUser = { id: string; username: string; displayName: string; avatarUrl?: string; avatarContentType?: string };
type ChatDto = { id: string; participant: PublicUser; updatedAt: string };
export type MessageDto = { id: string; clientMessageId: string; chatId: string; senderId: string; text: string; createdAt: string; deliveredAt: string | null };

@Injectable()
export class ChatsService {
  constructor(private readonly db: DatabaseService) {}

  async listChats(userId: string): Promise<ChatDto[]> {
    const result = await this.db.query<{ id: string; peer_id: string; username: string; display_name: string; avatar_id?: string; avatar_type?: string; updated_at: Date | string }>(
      `SELECT c.id, peer.id AS peer_id, peer.username, peer.display_name, a.id AS avatar_id, a.content_type AS avatar_type, c.updated_at
         FROM chats c
         JOIN chat_members own ON own.chat_id = c.id AND own.user_id = $1
         JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $1
         JOIN users peer ON peer.id = other.user_id
         LEFT JOIN profile_media a ON a.owner_id = peer.id AND a.slot = 'avatar'
        ORDER BY c.updated_at DESC, c.id`, [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      participant: this.publicUser({ ...row, id: row.peer_id }),
      updatedAt: this.asIso(row.updated_at),
    }));
  }

  async createDirectChat(userId: string, otherUserId: string): Promise<{ chat: ChatDto; created: boolean }> {
    if (userId === otherUserId) throw new ForbiddenException('Direct chat with yourself is not allowed');
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const users = await client.query<PublicUserRow>(`SELECT u.id, u.username, u.display_name, a.id AS avatar_id, a.content_type AS avatar_type
         FROM users u LEFT JOIN profile_media a ON a.owner_id = u.id AND a.slot = 'avatar'
        WHERE u.id = ANY($1::uuid[])`, [[userId, otherUserId]]);
      if (users.rows.length !== 2) throw new ForbiddenException('Chat creation is not allowed');
      const sorted = [userId, otherUserId].sort();
      const directKey = `${sorted[0]}:${sorted[1]}`;
      const inserted = await client.query<{ id: string }>('INSERT INTO chats(direct_key) VALUES ($1) ON CONFLICT (direct_key) DO NOTHING RETURNING id', [directKey]);
      const row = inserted.rows[0] ?? (await client.query<{ id: string }>('SELECT id FROM chats WHERE direct_key = $1', [directKey])).rows[0];
      if (!row) throw new Error('Direct chat creation failed');
      await client.query('INSERT INTO chat_members(chat_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING', [row.id, userId, otherUserId]);
      const updated = await client.query<{ updated_at: Date | string }>('SELECT updated_at FROM chats WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      const participant = users.rows.find((candidate) => candidate.id === otherUserId)!;
      return { chat: { id: row.id, participant: this.publicUser(participant), updatedAt: this.asIso(updated.rows[0].updated_at) }, created: Boolean(inserted.rowCount) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* already closed */ }
      throw error;
    } finally { client.release(); }
  }

  async listMessages(userId: string, chatId: string, after?: string, requestedLimit = 50): Promise<{ items: MessageDto[]; nextCursor: string | null }> {
    if (!await this.isMember(chatId, userId)) throw new ForbiddenException('User cannot access this chat');
    const limit = Math.min(100, Math.max(1, requestedLimit));
    let cursorTime: Date | undefined;
    if (after) {
      const cursor = await this.db.query<{ created_at: Date }>('SELECT created_at FROM messages WHERE id = $1 AND chat_id = $2', [after, chatId]);
      if (!cursor.rows[0]) throw new BadRequestException('Cursor message not found in this chat');
      cursorTime = cursor.rows[0].created_at;
    }
    const result = await this.db.query<MessageRow>(
      `SELECT id, client_message_id, chat_id, sender_id, text, created_at, delivered_at
         FROM messages
        WHERE chat_id = $1 AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::uuid))
        ORDER BY created_at ASC, id ASC LIMIT $4`,
      [chatId, cursorTime ?? null, after ?? null, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map((row) => this.message(row));
    return { items, nextCursor: hasMore && items.length ? items[items.length - 1].id : null };
  }

  async sendMessage(userId: string, chatId: string, key: string, text: string): Promise<{ message: MessageDto; created: boolean }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      if (!await this.isMemberWithClient(client, chatId, userId)) throw new ForbiddenException('User cannot send to this chat');
      const inserted = await client.query<MessageRow>(
        `INSERT INTO messages(chat_id, sender_id, client_message_id, text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (chat_id, sender_id, client_message_id) DO NOTHING
         RETURNING id, client_message_id, chat_id, sender_id, text, created_at, delivered_at`, [chatId, userId, key, text],
      );
      let row = inserted.rows[0];
      let created = true;
      if (!row) {
        const existing = await client.query<MessageRow>(
          `SELECT id, client_message_id, chat_id, sender_id, text, created_at, delivered_at
             FROM messages WHERE chat_id = $1 AND sender_id = $2 AND client_message_id = $3 FOR UPDATE`, [chatId, userId, key],
        );
        row = existing.rows[0];
        if (!row) throw new ConflictException('Message key conflict; retry the request');
        const decision = decideIdempotency(row.text, text);
        if (decision === 'conflict') throw new ConflictException('Idempotency key reused with different content');
        created = false;
      } else {
        await client.query('UPDATE chats SET updated_at = now() WHERE id = $1', [chatId]);
      }
      await client.query('COMMIT');
      return { message: this.message(row), created };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* already closed */ }
      throw error;
    } finally { client.release(); }
  }

  async isMember(chatId: string, userId: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  private async isMemberWithClient(client: PoolClient, chatId: string, userId: string): Promise<boolean> {
    const result = await client.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, userId]);
    return (result.rowCount ?? 0) > 0;
  }
  private publicUser(row: PublicUserRow): PublicUser {
    const profile = { id: row.id, username: row.username, displayName: row.display_name };
    return row.avatar_id ? { ...profile, avatarUrl: `/api/v1/users/media/${row.avatar_id}`, avatarContentType: row.avatar_type } : profile;
  }
  private message(row: MessageRow): MessageDto {
    return {
      id: row.id, clientMessageId: row.client_message_id, chatId: row.chat_id, senderId: row.sender_id,
      text: row.text, createdAt: this.asIso(row.created_at), deliveredAt: row.delivered_at ? this.asIso(row.delivered_at) : null,
    };
  }
  private asIso(value: Date | string): string { return new Date(value).toISOString(); }
}
