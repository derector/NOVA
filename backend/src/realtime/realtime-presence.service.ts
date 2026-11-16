import { Injectable, OnModuleDestroy } from '@nestjs/common';

export interface PresenceSnapshot {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string | null;
}

interface TtlEntry {
  expiresAt: number;
}

/**
 * Ephemeral realtime state only. PostgreSQL remains the source of truth for
 * durable data. This store is intentionally replaceable by a Redis adapter
 * when NOVA runs more than one API instance.
 */
@Injectable()
export class RealtimePresenceService implements OnModuleDestroy {
  private readonly presence = new Map<string, TtlEntry>();
  private readonly typing = new Map<string, TtlEntry>();
  private readonly ttlMs = this.readTtl();
  private readonly cleanupTimer = setInterval(() => this.cleanup(), Math.max(1_000, Math.floor(this.ttlMs / 2)));

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  heartbeat(userId: string, now = Date.now()): PresenceSnapshot {
    this.presence.set(userId, { expiresAt: now + this.ttlMs });
    return { userId, status: 'online', lastSeenAt: null };
  }

  disconnect(userId: string, now = Date.now()): PresenceSnapshot {
    this.presence.delete(userId);
    return { userId, status: 'offline', lastSeenAt: new Date(now).toISOString() };
  }

  get(userId: string, now = Date.now()): PresenceSnapshot {
    const entry = this.presence.get(userId);
    if (!entry || entry.expiresAt <= now) {
      this.presence.delete(userId);
      return { userId, status: 'offline', lastSeenAt: null };
    }
    return { userId, status: 'online', lastSeenAt: null };
  }

  setTyping(chatId: string, userId: string, now = Date.now()): boolean {
    const key = this.typingKey(chatId, userId);
    const wasTyping = this.typing.has(key) && (this.typing.get(key)?.expiresAt ?? 0) > now;
    if (wasTyping) return false;
    this.typing.set(key, { expiresAt: now + Math.min(this.ttlMs, 8_000) });
    return true;
  }

  stopTyping(chatId: string, userId: string): boolean {
    const key = this.typingKey(chatId, userId);
    const existed = this.typing.has(key);
    this.typing.delete(key);
    return existed;
  }

  isTyping(chatId: string, userId: string, now = Date.now()): boolean {
    const entry = this.typing.get(this.typingKey(chatId, userId));
    if (!entry || entry.expiresAt <= now) {
      this.typing.delete(this.typingKey(chatId, userId));
      return false;
    }
    return true;
  }

  private cleanup(now = Date.now()): void {
    for (const [key, entry] of this.presence) if (entry.expiresAt <= now) this.presence.delete(key);
    for (const [key, entry] of this.typing) if (entry.expiresAt <= now) this.typing.delete(key);
  }

  private typingKey(chatId: string, userId: string): string { return `${chatId}:${userId}`; }

  private readTtl(): number {
    const configured = Number(process.env.REALTIME_PRESENCE_TTL_MS ?? 60_000);
    return Number.isFinite(configured) ? Math.max(10_000, Math.min(configured, 10 * 60_000)) : 60_000;
  }
}
