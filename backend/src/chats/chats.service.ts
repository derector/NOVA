import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { decideIdempotency } from '../common/security.helpers';
import type { PoolClient } from 'pg';

interface PublicUserRow { id: string; username: string; display_name: string }
interface MessageRow { id: string; client_message_id: string; chat_id: string; sender_id: string; text: string; created_at: Date | string; delivered_at: Date | string | null; read_at: Date | string | null; edited_at: Date | string | null; deleted_at: Date | string | null }
type PublicUser = { id: string; username: string; displayName: string };
export type ChatDto = { id: string; participant: PublicUser; updatedAt: string; unreadCount: number; mutedUntil: string | null };
export type MessageDto = { id: string; clientMessageId: string; chatId: string; senderId: string; text: string; createdAt: string; deliveredAt: string | null; readAt: string | null; editedAt: string | null; deletedAt: string | null };

@Injectable()
export class ChatsService {
  constructor(private readonly db: DatabaseService) {}

  async listChats(userId: string): Promise<ChatDto[]> {
    const result = await this.db.query<{ id: string; peer_id: string; username: string; display_name: string; updated_at: Date | string; unread_count: string; muted_until: Date | string | null }>(
      `SELECT c.id, peer.id AS peer_id, peer.username, peer.display_name, c.updated_at,
              (SELECT COUNT(*) FROM messages m
                WHERE m.chat_id = c.id AND m.sender_id <> $1
                  AND NOT EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = m.id AND r.user_id = $1 AND r.read_at IS NOT NULL)) AS unread_count,
              CASE WHEN pref.muted_until > now() THEN pref.muted_until ELSE NULL END AS muted_until
         FROM chats c
         JOIN chat_members own ON own.chat_id = c.id AND own.user_id = $1
         JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $1
         JOIN users peer ON peer.id = other.user_id
         LEFT JOIN chat_notification_preferences pref ON pref.chat_id = c.id AND pref.user_id = $1
        ORDER BY c.updated_at DESC, c.id`, [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      participant: { id: row.peer_id, username: row.username, displayName: row.display_name },
      updatedAt: this.asIso(row.updated_at), unreadCount: Number(row.unread_count), mutedUntil: row.muted_until ? this.asIso(row.muted_until) : null,
    }));
  }

  async createDirectChat(userId: string, otherUserId: string): Promise<ChatDto> {
    if (userId === otherUserId) throw new ForbiddenException('Direct chat with yourself is not allowed');
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const users = await client.query<PublicUserRow>('SELECT id, username, display_name FROM users WHERE id = ANY($1::uuid[])', [[userId, otherUserId]]);
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
      return { id: row.id, participant: this.publicUser(participant), updatedAt: this.asIso(updated.rows[0].updated_at), unreadCount: 0, mutedUntil: null };
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
      `SELECT m.id, m.client_message_id, m.chat_id, m.sender_id,
              CASE WHEN m.deleted_at IS NULL THEN m.text ELSE 'Сообщение удалено' END AS text,
              m.created_at, m.delivered_at, MAX(r.read_at) AS read_at, m.edited_at, m.deleted_at
         FROM messages m
         LEFT JOIN message_receipts r ON r.message_id = m.id AND r.user_id <> m.sender_id
        WHERE m.chat_id = $1 AND ($2::timestamptz IS NULL OR (m.created_at, m.id) > ($2::timestamptz, $3::uuid))
        GROUP BY m.id
        ORDER BY m.created_at ASC, m.id ASC LIMIT $4`,
      [chatId, cursorTime ?? null, after ?? null, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map((row) => this.message(row));
    return { items, nextCursor: hasMore && items.length ? items[items.length - 1].id : null };
  }

  async updateNotificationPreference(userId: string, chatId: string, mutedUntil: string | null, previewEnabled = true): Promise<{ chatId: string; mutedUntil: string | null; previewEnabled: boolean }> {
    if (!await this.isMember(chatId, userId)) throw new ForbiddenException('User cannot access this chat');
    const result = await this.db.query<{ muted_until: Date | string | null; preview_enabled: boolean }>(
      `INSERT INTO chat_notification_preferences(user_id, chat_id, muted_until, preview_enabled, updated_at)
       VALUES ($1, $2, $3::timestamptz, $4, now())
       ON CONFLICT (user_id, chat_id) DO UPDATE SET muted_until = EXCLUDED.muted_until, preview_enabled = EXCLUDED.preview_enabled, updated_at = now()
       RETURNING muted_until, preview_enabled`, [userId, chatId, mutedUntil, previewEnabled],
    );
    const row = result.rows[0];
    return { chatId, mutedUntil: row.muted_until ? this.asIso(row.muted_until) : null, previewEnabled: row.preview_enabled };
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
         RETURNING id, client_message_id, chat_id, sender_id, text, created_at, delivered_at, NULL::timestamptz AS read_at, edited_at, deleted_at`, [chatId, userId, key, text],
      );
      let row = inserted.rows[0];
      let created = true;
      if (!row) {
        const existing = await client.query<MessageRow>(
          `SELECT id, client_message_id, chat_id, sender_id, text, created_at, delivered_at, NULL::timestamptz AS read_at, edited_at, deleted_at
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

  async editMessage(userId: string, chatId: string, messageId: string, text: string): Promise<MessageDto> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      if (!await this.isMemberWithClient(client, chatId, userId)) throw new ForbiddenException('User cannot access this chat');
      const result = await client.query<MessageRow>(
        `UPDATE messages SET text = $4, edited_at = now()
          WHERE id = $1 AND chat_id = $2 AND sender_id = $3 AND deleted_at IS NULL AND created_at > now() - interval '15 minutes'
          RETURNING id, client_message_id, chat_id, sender_id, text, created_at, delivered_at, NULL::timestamptz AS read_at, edited_at, deleted_at`,
        [messageId, chatId, userId, text.trim()],
      );
      if (!result.rows[0]) throw new ConflictException('Message cannot be edited: it may be deleted, too old, or not yours');
      await client.query('UPDATE chats SET updated_at = now() WHERE id = $1', [chatId]);
      await client.query('COMMIT');
      return this.message(result.rows[0]);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* already closed */ }
      throw error;
    } finally { client.release(); }
  }

  async deleteMessage(userId: string, chatId: string, messageId: string): Promise<MessageDto> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      if (!await this.isMemberWithClient(client, chatId, userId)) throw new ForbiddenException('User cannot access this chat');
      const result = await client.query<MessageRow>(
        `UPDATE messages SET deleted_at = now()
          WHERE id = $1 AND chat_id = $2 AND sender_id = $3 AND deleted_at IS NULL
          RETURNING id, client_message_id, chat_id, sender_id, 'Сообщение удалено' AS text, created_at, delivered_at, NULL::timestamptz AS read_at, edited_at, deleted_at`,
        [messageId, chatId, userId],
      );
      if (!result.rows[0]) throw new ConflictException('Message cannot be deleted or is not yours');
      await client.query('UPDATE chats SET updated_at = now() WHERE id = $1', [chatId]);
      await client.query('COMMIT');
      return this.message(result.rows[0]);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* already closed */ }
      throw error;
    } finally { client.release(); }
  }

  async markRead(userId: string, chatId: string): Promise<string[]> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      if (!await this.isMemberWithClient(client, chatId, userId)) throw new ForbiddenException('User cannot access this chat');
      const unread = await client.query<{ id: string }>(
        `SELECT m.id FROM messages m
          WHERE m.chat_id = $1 AND m.sender_id <> $2
            AND NOT EXISTS (SELECT 1 FROM message_receipts r WHERE r.message_id = m.id AND r.user_id = $2 AND r.read_at IS NOT NULL)`,
        [chatId, userId],
      );
      const ids = unread.rows.map((row) => row.id);
      if (ids.length) {
        await client.query(
          `INSERT INTO message_receipts(message_id, user_id, delivered_at, read_at)
           SELECT id, $2, now(), now() FROM messages WHERE id = ANY($1::uuid[])
           ON CONFLICT (message_id, user_id) DO UPDATE SET delivered_at = COALESCE(message_receipts.delivered_at, now()), read_at = now()`,
          [ids, userId],
        );
        await client.query('UPDATE messages SET delivered_at = COALESCE(delivered_at, now()) WHERE id = ANY($1::uuid[])', [ids]);
      }
      await client.query('COMMIT');
      return ids;
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
  private publicUser(row: PublicUserRow): PublicUser { return { id: row.id, username: row.username, displayName: row.display_name }; }
  private message(row: MessageRow): MessageDto {
    return {
      id: row.id, clientMessageId: row.client_message_id, chatId: row.chat_id, senderId: row.sender_id,
      text: row.text, createdAt: this.asIso(row.created_at), deliveredAt: row.delivered_at ? this.asIso(row.delivered_at) : null, readAt: row.read_at ? this.asIso(row.read_at) : null,
      editedAt: row.edited_at ? this.asIso(row.edited_at) : null, deletedAt: row.deleted_at ? this.asIso(row.deleted_at) : null,
    };
  }
  private asIso(value: Date | string): string { return new Date(value).toISOString(); }
}
