import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.module';
import { randomUUID } from 'node:crypto';
import { RealtimePresenceService } from './realtime-presence.service';

const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
interface ChatAction { chatId?: string }
interface TypingAction extends ChatAction { isTyping?: boolean }

@Injectable()
@WebSocketGateway({ cors: { origin: corsOrigins, credentials: true }, transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
    private readonly presence: RealtimePresenceService,
  ) {}

  afterInit(server: Server): void {
    // Authenticate before the connection is accepted so a client that emits
    // chat:join immediately after connect cannot race the async token check.
    server.use(async (client, next) => {
      try {
        const token = client.handshake.auth?.token;
        const identity = typeof token === 'string' ? await this.auth.authenticate(token) : null;
        if (!identity) return next(new Error('unauthorized'));
        client.data.userId = identity.userId;
        client.data.sessionId = identity.sessionId;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  handleConnection(client: Socket): void {
    if (!client.data.userId) return;
    void client.join(this.userRoom(client.data.userId));
    const snapshot = this.presence.heartbeat(client.data.userId);
    void this.emitPresenceToMemberships(client.data.userId, snapshot);
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const stillConnected = [...this.server.sockets.sockets.values()].some((socket) => socket.id !== client.id && socket.data.userId === userId);
    if (stillConnected) return;
    const snapshot = this.presence.disconnect(userId);
    void this.emitPresenceToMemberships(userId, snapshot);
  }

  @SubscribeMessage('chat:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() payload: ChatAction) {
    const chatId = payload?.chatId;
    if (!this.validUuid(chatId) || !client.data.userId) return this.actionError('Invalid chatId');
    if (!await this.isMember(chatId, client.data.userId)) return this.actionError('Chat access denied');
    await client.join(this.room(chatId));
    return { ok: true, chatId };
  }

  @SubscribeMessage('chat:leave')
  async leave(@ConnectedSocket() client: Socket, @MessageBody() payload: ChatAction) {
    const chatId = payload?.chatId;
    if (!this.validUuid(chatId) || !client.data.userId) return this.actionError('Invalid chatId');
    if (!await this.isMember(chatId, client.data.userId)) return this.actionError('Chat access denied');
    await client.leave(this.room(chatId));
    return { ok: true, chatId };
  }

  @SubscribeMessage('presence:heartbeat')
  heartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return this.actionError('Unauthorized');
    const snapshot = this.presence.heartbeat(userId);
    return { ok: true, presence: snapshot };
  }

  @SubscribeMessage('typing:set')
  async typing(@ConnectedSocket() client: Socket, @MessageBody() payload: TypingAction) {
    const chatId = payload?.chatId;
    const userId = client.data.userId as string | undefined;
    if (!this.validUuid(chatId) || !userId) return this.actionError('Invalid chatId');
    if (!await this.isMember(chatId, userId)) return this.actionError('Chat access denied');
    const active = payload?.isTyping !== false;
    const changed = active ? this.presence.setTyping(chatId, userId) : this.presence.stopTyping(chatId, userId);
    if (changed && this.server) {
      client.to(this.room(chatId)).emit('typing:update', { chatId, userId, isTyping: active });
    }
    return { ok: true, chatId, isTyping: active };
  }

  emitMessage(message: { id: string; clientMessageId: string; chatId: string; senderId: string; text: string; createdAt: string }): void {
    if (!this.server) return;
    this.server.to(this.room(message.chatId)).emit('message:new', message);
    this.server.to(this.room(message.chatId)).except(this.userRoom(message.senderId)).emit('notification:new', { type: 'message', chatId: message.chatId, messageId: message.id, senderId: message.senderId });
  }

  emitRead(event: { chatId: string; userId: string; messageIds: string[] }): void {
    if (!this.server || !event.messageIds.length) return;
    this.server.to(this.room(event.chatId)).emit('message:read', event);
  }

  emitMessageUpdated(message: { id: string; chatId: string; text: string; editedAt: string | null }): void {
    if (this.server) this.server.to(this.room(message.chatId)).emit('message:updated', message);
  }

  emitMessageDeleted(message: { id: string; chatId: string; text: string; deletedAt: string | null }): void {
    if (this.server) this.server.to(this.room(message.chatId)).emit('message:deleted', message);
  }

  private async emitPresenceToMemberships(userId: string, snapshot: { userId: string; status: 'online' | 'offline'; lastSeenAt: string | null }): Promise<void> {
    if (!this.server) return;
    const memberships = await this.db.query('SELECT chat_id FROM chat_members WHERE user_id = $1', [userId]);
    for (const row of memberships.rows as Array<{ chat_id: string }>) {
      this.server.to(this.room(row.chat_id)).except(this.userRoom(userId)).emit('presence:update', snapshot);
    }
  }

  private async isMember(chatId: string, userId: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, userId]);
    return (result.rowCount ?? 0) > 0;
  }
  private room(chatId: string): string { return `chat:${chatId}`; }
  private userRoom(userId: string): string { return `user:${userId}`; }
  private validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
  private actionError(message: string) { return { ok: false, error: { code: 'FORBIDDEN', message, requestId: randomUUID() } }; }
}
