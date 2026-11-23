import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.module';
import { randomUUID } from 'node:crypto';
import { callIceServers, DirectCalls, parseCallSignal } from './direct-calls';
import type { CallEnd, CallKind, CallParty, DirectCall } from './direct-calls';

const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
interface ChatAction { chatId?: string }
interface CallAction { callId?: string }

@Injectable()
@WebSocketGateway({
  cors: { origin: corsOrigins, credentials: true },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 128 * 1024,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly calls = new DirectCalls((call, reason) => this.emitCallEnded(call, reason));

  constructor(private readonly auth: AuthService, private readonly db: DatabaseService) {}

  afterInit(server: Server): void {
    server.use(async (client, next) => {
      try {
        const token = client.handshake.auth?.token;
        const identity = typeof token === 'string' ? await this.auth.authenticate(token) : null;
        if (!identity) { next(new Error('Unauthorized')); return; }
        client.data.userId = identity.userId;
        client.data.sessionId = identity.sessionId;
        next();
      } catch {
        this.logger.warn('Socket authentication failed');
        next(new Error('Authentication unavailable'));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    await client.join(this.userRoom(client.data.userId));
  }

  handleDisconnect(client: Socket): void {
    const party = this.callParty(client);
    if (!party) return;
    this.calls.disconnected(party, (kind) => Boolean(this.server.sockets.adapter.rooms.get(this.callRoom(party.userId, kind))?.size));
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

  @SubscribeMessage('call:ready')
  async readyForCalls(@ConnectedSocket() client: Socket, @MessageBody() payload?: { audioOnly?: boolean }) {
    if (!client.data.userId) return this.actionError('Войдите, чтобы принимать звонки.');
    if (client.data.callReady) return { ok: true };
    const audioOnly = payload?.audioOnly === true;
    const rooms = [this.callRoom(client.data.userId, 'audio')];
    if (!audioOnly) rooms.push(this.callRoom(client.data.userId, 'video'));
    await client.join(rooms);
    client.data.callAudioOnly = audioOnly;
    client.data.callReady = true;
    return { ok: true };
  }

  @SubscribeMessage('call:start')
  async startCall(@ConnectedSocket() client: Socket, @MessageBody() payload: ChatAction & { kind?: unknown }) {
    const party = this.callParty(client);
    const chatId = payload?.chatId;
    const kind = payload?.kind;
    if (!party || !this.validUuid(chatId) || (kind !== 'audio' && kind !== 'video') || (kind === 'video' && party.audioOnly)) {
      return this.actionError('Звонок доступен только из личного чата.');
    }
    const now = Date.now();
    if (typeof client.data.lastCallAttemptAt === 'number' && now - client.data.lastCallAttemptAt < 2500) {
      return this.actionError('Подождите несколько секунд перед повторным звонком.');
    }
    client.data.lastCallAttemptAt = now;

    const result = await this.db.query<{ caller_name: string; callee_id: string }>(
      `SELECT u.display_name AS caller_name, other.user_id AS callee_id
         FROM chats c
         JOIN chat_members own ON own.chat_id = c.id AND own.user_id = $2
         JOIN users u ON u.id = own.user_id
         JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $2
        WHERE c.id = $1 AND c.direct_key IS NOT NULL`,
      [chatId, party.userId],
    );
    if (!client.connected || result.rows.length !== 1) return this.actionError('Звонок доступен только участникам личного чата.');
    const { caller_name, callee_id } = result.rows[0];
    const calleeRoom = this.callRoom(callee_id, kind);
    if (!this.server.sockets.adapter.rooms.get(calleeRoom)?.size) {
      return this.actionError('Собеседник сейчас недоступен для звонка.');
    }
    const call = this.calls.start(chatId, kind, party, caller_name, callee_id);
    if (!call) return this.actionError('Собеседник уже участвует в звонке.');
    this.server.to(calleeRoom).emit('call:invite', call.invite);
    return { ok: true, callId: call.invite.id, iceServers: callIceServers() };
  }

  @SubscribeMessage('call:accept')
  acceptCall(@ConnectedSocket() client: Socket, @MessageBody() payload: CallAction) {
    const party = this.callParty(client);
    const callId = payload?.callId;
    const call = party && this.validUuid(callId) ? this.calls.accept(callId, party) : null;
    if (!call) return this.actionError('Этот звонок уже завершён или принят на другом устройстве.');
    this.server.to(call.caller.socketId).emit('call:accepted', { callId });
    this.server.to(this.callRoom(call.calleeId, call.invite.kind)).except(client.id).emit('call:dismissed', { callId });
    return { ok: true, callId, iceServers: callIceServers() };
  }

  @SubscribeMessage('call:end')
  endCall(@ConnectedSocket() client: Socket, @MessageBody() payload: CallAction) {
    const party = this.callParty(client);
    if (party && this.validUuid(payload?.callId)) this.calls.hangUp(payload.callId, party);
  }

  @SubscribeMessage('call:signal')
  relaySignal(@ConnectedSocket() client: Socket, @MessageBody() payload: CallAction) {
    const party = this.callParty(client);
    const callId = payload?.callId;
    if (!party || !this.validUuid(callId)) return this.actionError('Сигнал звонка отклонён.');
    const signal = parseCallSignal(payload);
    const recipient = signal ? this.calls.relay(callId, party, signal) : null;
    if (!recipient) return this.actionError('Сигнал звонка отклонён.');
    this.server.to(recipient).emit('call:signal', { callId, ...signal });
    return { ok: true };
  }

  emitMessage(message: { id: string; clientMessageId: string; chatId: string; senderId: string; text: string; createdAt: string }): void {
    if (!this.server) return;
    this.server.to(this.room(message.chatId)).emit('message:new', message);
  }

  emitChatCreated(userIds: string[], chatId: string): void {
    if (!this.server) return;
    this.server.to(userIds.map((userId) => this.userRoom(userId))).emit('chat:new', { chatId });
  }

  private emitCallEnded(call: DirectCall, reason: CallEnd): void {
    const audience = [call.caller.socketId, call.callee?.socketId ?? this.callRoom(call.calleeId, call.invite.kind)];
    this.server.to(audience).emit('call:ended', { callId: call.invite.id, reason });
  }

  private callParty(client: Socket): CallParty | null {
    return client.data.callReady && typeof client.data.userId === 'string'
      ? { userId: client.data.userId, socketId: client.id, audioOnly: client.data.callAudioOnly === true }
      : null;
  }
  private async isMember(chatId: string, userId: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, userId]);
    return (result.rowCount ?? 0) > 0;
  }
  private room(chatId: string): string { return `chat:${chatId}`; }
  private userRoom(userId: string): string { return `user:${userId}`; }
  private callRoom(userId: string, kind: CallKind): string { return `ring:${kind}:${userId}`; }
  private validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
  private actionError(message: string) { return { ok: false, error: { code: 'FORBIDDEN', message, requestId: randomUUID() } }; }
}
