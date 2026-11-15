import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import nodemailer, { Transporter } from 'nodemailer';
import { DatabaseService } from '../database/database.module';
import { generateOtp, hashSecret, secretMatches } from '../common/security.helpers';
import type { TokenResponse, UserResponse } from './auth.dto';
import type { PoolClient } from 'pg';

interface UserRow { id: string; email: string; username: string; display_name: string }
interface SessionClaims { sub?: string; sid?: string }

@Injectable()
export class AuthService {
  private readonly secret = this.readSecret();
  private readonly accessTtl = this.positiveInt('ACCESS_TOKEN_TTL_SECONDS', 900);
  private readonly refreshDays = this.positiveInt('REFRESH_TOKEN_TTL_DAYS', 30);
  private mailer?: Transporter;

  constructor(private readonly db: DatabaseService) {}

  async requestCode(emailInput: string, ip: string): Promise<void> {
    const email = this.normalizeEmail(emailInput);
    await this.enforceLimit('request-email', email, 3, 900);
    await this.enforceLimit('request-ip', ip, 10, 900);
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    if (!host || !from) throw new ServiceUnavailableException('Email delivery is not configured');

    const code = generateOtp();
    const digest = hashSecret(code, this.secret);
    const ttlMinutes = this.positiveInt('OTP_TTL_MINUTES', 10);
    await this.db.query(
      `INSERT INTO otp_challenges(email, code_hash, expires_at, attempts, consumed_at)
       VALUES ($1, $2, now() + make_interval(mins => $3), 0, NULL)
       ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
         attempts = 0, consumed_at = NULL, created_at = now()`,
      [email, digest, ttlMinutes],
    );
    try {
      const port = this.positiveInt('SMTP_PORT', 587);
      this.mailer ??= nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: port === 587 || port === 2525,
        auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      await this.mailer.sendMail({
        from,
        to: email,
        subject: 'Код входа в NOVA',
        text: `Ваш код для входа в NOVA: ${code}. Он действует ${ttlMinutes} мин. Если вы не запрашивали код, просто проигнорируйте это письмо.`,
      });
    } catch {
      await this.db.query('UPDATE otp_challenges SET consumed_at = now() WHERE email = $1 AND code_hash = $2', [email, digest]);
      throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
    }
  }

  async verifyCode(emailInput: string, code: string): Promise<TokenResponse> {
    const email = this.normalizeEmail(emailInput);
    await this.enforceLimit('verify-email', email, 10, 900);
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ code_hash: string; attempts: number; expires_at: Date; consumed_at: Date | null }>(
        'SELECT code_hash, attempts, expires_at, consumed_at FROM otp_challenges WHERE email = $1 FOR UPDATE', [email],
      );
      const challenge = result.rows[0];
      const maxAttempts = this.positiveInt('OTP_MAX_ATTEMPTS', 5);
      if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= maxAttempts) {
        if (challenge && !challenge.consumed_at) await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE email = $1', [email]);
        await client.query('COMMIT');
        throw new BadRequestException('Invalid, expired or already-used code');
      }
      if (!secretMatches(code, challenge.code_hash, this.secret)) {
        const attempts = challenge.attempts + 1;
        await client.query('UPDATE otp_challenges SET attempts = $2, consumed_at = CASE WHEN $2 >= $3 THEN now() ELSE consumed_at END WHERE email = $1', [email, attempts, maxAttempts]);
        await client.query('COMMIT');
        throw new BadRequestException('Invalid, expired or already-used code');
      }
      await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE email = $1', [email]);
      const user = await this.findOrCreateUser(client, email);
      const response = await this.createSession(client, user);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be committed */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const tokenHash = hashSecret(refreshToken, this.secret);
      const result = await client.query<{ id: string; user_id: string; expires_at: Date; revoked_at: Date | null; email: string; username: string; display_name: string }>(
        `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.email, u.username, u.display_name
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.refresh_token_hash = $1 FOR UPDATE OF s`, [tokenHash],
      );
      const session = result.rows[0];
      if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
        await client.query('ROLLBACK');
        throw new UnauthorizedException('Invalid, expired or revoked refresh token');
      }
      const nextToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + this.refreshDays * 86_400_000);
      await client.query('UPDATE sessions SET refresh_token_hash = $2, expires_at = $3, last_used_at = now() WHERE id = $1', [session.id, hashSecret(nextToken, this.secret), expiresAt]);
      const user: UserResponse = { id: session.user_id, email: session.email, username: session.username, displayName: session.display_name };
      const response = this.tokens(user, session.id, nextToken);
      await client.query('COMMIT');
      return response;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be rolled back */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.db.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
  }

  async authenticate(token: string): Promise<{ userId: string; sessionId: string } | null> {
    if (!token) return null;
    let claims: string | jwt.JwtPayload;
    try { claims = jwt.verify(token, this.secret); } catch { return null; }
    if (typeof claims === 'string' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return null;
    const active = await this.db.query(
      'SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()',
      [claims.sid, claims.sub],
    );
    return active.rowCount ? { userId: claims.sub, sessionId: claims.sid } : null;
  }

  private async enforceLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<void> {
    const key = hashSecret(`${scope}:${identity}`, this.secret);
    const result = await this.db.query<{ hit_count: number; window_started_at: Date }>(
      `INSERT INTO rate_limit_buckets(bucket_key, window_started_at, hit_count)
       VALUES ($1, now(), 1)
       ON CONFLICT (bucket_key) DO UPDATE SET
         hit_count = CASE WHEN rate_limit_buckets.window_started_at <= now() - make_interval(secs => $2) THEN 1 ELSE rate_limit_buckets.hit_count + 1 END,
         window_started_at = CASE WHEN rate_limit_buckets.window_started_at <= now() - make_interval(secs => $2) THEN now() ELSE rate_limit_buckets.window_started_at END
       RETURNING hit_count, window_started_at`, [key, windowSeconds],
    );
    const row = result.rows[0];
    if (row.hit_count > limit) throw new HttpException('Rate limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async findOrCreateUser(client: PoolClient, email: string): Promise<UserResponse> {
    const existing = await client.query<UserRow>('SELECT id, email, username, display_name FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return this.toUser(existing.rows[0]);
    const local = email.split('@')[0] ?? 'nova_user';
    const base = local.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 22);
    const prefix = base.length >= 3 ? base : `user${base}`.slice(0, 22);
    const displayName = (local || 'NOVA user').slice(0, 80);
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = `${prefix}_${randomBytes(3).toString('hex')}`.slice(0, 32);
      const inserted = await client.query<UserRow>(
        `INSERT INTO users(email, username, display_name) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING id, email, username, display_name`, [email, username, displayName],
      );
      if (inserted.rows[0]) return this.toUser(inserted.rows[0]);
      const raced = await client.query<UserRow>('SELECT id, email, username, display_name FROM users WHERE email = $1', [email]);
      if (raced.rows[0]) return this.toUser(raced.rows[0]);
    }
    throw new ServiceUnavailableException('Unable to create account');
  }

  private async createSession(client: PoolClient, user: UserResponse): Promise<TokenResponse> {
    const sid = randomUUID();
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshDays * 86_400_000);
    await client.query('INSERT INTO sessions(id, user_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, $4)', [sid, user.id, hashSecret(refreshToken, this.secret), expiresAt]);
    return this.tokens(user, sid, refreshToken);
  }

  private tokens(user: UserResponse, sessionId: string, refreshToken: string): TokenResponse {
    const now = Date.now();
    const accessToken = jwt.sign({ sid: sessionId }, this.secret, { subject: user.id, expiresIn: this.accessTtl, issuer: 'nova-api', audience: 'nova-clients' });
    return { accessToken, accessTokenExpiresAt: new Date(now + this.accessTtl * 1000).toISOString(), refreshToken, user };
  }

  private toUser(row: UserRow): UserResponse {
    return { id: row.id, email: row.email, username: row.username, displayName: row.display_name };
  }

  private normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
  private readSecret(): string {
    const value = process.env.APP_SECRET;
    if (!value || Buffer.byteLength(value) < 32 || value.startsWith('REPLACE_WITH_')) throw new Error('APP_SECRET must be a private random value of at least 32 bytes');
    return value;
  }
  private positiveInt(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
    return value;
  }
}
