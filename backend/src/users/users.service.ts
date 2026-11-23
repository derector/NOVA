import { BadRequestException, ConflictException, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import type { UpdateProfileDto } from './users.dto';
import { MediaSlot, profileMediaType } from './profile-media';

interface UserRow extends PublicUserRow {
  email: string;
  bio: string;
  cover_id: string | null;
  cover_type: string | null;
}
interface PublicUserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_id?: string | null;
  avatar_type?: string | null;
}
type UserDto = PublicUserDto & { email: string; bio: string; coverUrl: string | null; coverContentType: string | null };
type PublicUserDto = { id: string; username: string; displayName: string; avatarUrl?: string | null; avatarContentType?: string | null };

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async me(userId: string): Promise<UserDto> {
    const result = await this.db.query<UserRow>(`SELECT u.id, u.email, u.username, u.display_name, u.bio,
              a.id AS avatar_id, a.content_type AS avatar_type, c.id AS cover_id, c.content_type AS cover_type
         FROM users u
         LEFT JOIN profile_media a ON a.owner_id = u.id AND a.slot = 'avatar'
         LEFT JOIN profile_media c ON c.owner_id = u.id AND c.slot = 'cover'
        WHERE u.id = $1`, [userId]);
    if (!result.rows[0]) throw new NotFoundException('User not found');
    return this.map(result.rows[0]);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const changes: string[] = [];
    const values: unknown[] = [];
    if (typeof dto.username === 'string') { values.push(dto.username.toLowerCase()); changes.push(`username = $${values.length}`); }
    if (typeof dto.displayName === 'string') {
      const displayName = dto.displayName.trim();
      if (!displayName) throw new BadRequestException('displayName must not be blank');
      values.push(displayName); changes.push(`display_name = $${values.length}`);
    }
    if (typeof dto.bio === 'string') { values.push(dto.bio.trim()); changes.push(`bio = $${values.length}`); }
    if (changes.length === 0) throw new BadRequestException('Provide username, displayName or bio');
    changes.push('updated_at = now()');
    values.push(userId);
    try {
      const result = await this.db.query(
        `UPDATE users SET ${changes.join(', ')} WHERE id = $${values.length}`, values,
      );
      if (!result.rowCount) throw new NotFoundException('User not found');
      return this.me(userId);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Username is already taken');
      throw error;
    }
  }

  async search(username: string, currentUserId: string): Promise<PublicUserDto[]> {
    const result = await this.db.query<PublicUserRow>(
      `SELECT u.id, u.username, u.display_name, a.id AS avatar_id, a.content_type AS avatar_type
         FROM users u LEFT JOIN profile_media a ON a.owner_id = u.id AND a.slot = 'avatar'
        WHERE u.id <> $1 AND position(lower($2) in lower(u.username)) > 0
        ORDER BY u.username LIMIT 25`, [currentUserId, username],
    );
    return result.rows.map((row) => this.publicProfile(row));
  }

  async putMedia(userId: string, slot: MediaSlot, data: Buffer): Promise<UserDto> {
    const type = profileMediaType(data);
    if (!type) throw new UnsupportedMediaTypeException('Supported formats: PNG, JPEG, WebP, GIF, MP4, WebM');
    await this.db.query(
      `INSERT INTO profile_media(owner_id, slot, content_type, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id, slot) DO UPDATE SET id = EXCLUDED.id, content_type = EXCLUDED.content_type, data = EXCLUDED.data`,
      [userId, slot, type, data],
    );
    return this.me(userId);
  }

  async removeMedia(userId: string, slot: MediaSlot): Promise<UserDto> {
    await this.db.query('DELETE FROM profile_media WHERE owner_id = $1 AND slot = $2', [userId, slot]);
    return this.me(userId);
  }

  async getMedia(id: string): Promise<{ data: Buffer; content_type: string }> {
    const result = await this.db.query<{ data: Buffer; content_type: string }>('SELECT data, content_type FROM profile_media WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Profile media not found');
    return result.rows[0];
  }

  private publicProfile(row: PublicUserRow): PublicUserDto {
    const publicFields = { id: row.id, username: row.username, displayName: row.display_name };
    return row.avatar_id ? { ...publicFields, avatarUrl: `/api/v1/users/media/${row.avatar_id}`, avatarContentType: row.avatar_type } : publicFields;
  }

  private map(row: UserRow): UserDto {
    return {
      ...this.publicProfile(row), email: row.email, bio: row.bio,
      avatarUrl: row.avatar_id ? `/api/v1/users/media/${row.avatar_id}` : null,
      avatarContentType: row.avatar_type ?? null,
      coverUrl: row.cover_id ? `/api/v1/users/media/${row.cover_id}` : null,
      coverContentType: row.cover_type,
    };
  }
  private isUniqueViolation(error: unknown): boolean { return !!error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505'; }
}
