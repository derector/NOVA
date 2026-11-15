import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import type { UpdateProfileDto } from './users.dto';

interface UserRow { id: string; email: string; username: string; display_name: string }
interface PublicUserRow { id: string; username: string; display_name: string }
type UserDto = { id: string; email: string; username: string; displayName: string };
type PublicUserDto = { id: string; username: string; displayName: string };

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async me(userId: string): Promise<UserDto> {
    const result = await this.db.query<UserRow>('SELECT id, email, username, display_name FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]) throw new NotFoundException('User not found');
    return this.map(result.rows[0]);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const changes: string[] = [];
    const values: unknown[] = [];
    if (dto.username !== undefined) { values.push(dto.username.toLowerCase()); changes.push(`username = $${values.length}`); }
    if (dto.displayName !== undefined) {
      const displayName = dto.displayName.trim();
      if (!displayName) throw new BadRequestException('displayName must not be blank');
      values.push(displayName); changes.push(`display_name = $${values.length}`);
    }
    if (changes.length === 0) throw new BadRequestException('Provide username or displayName');
    changes.push('updated_at = now()');
    values.push(userId);
    try {
      const result = await this.db.query<UserRow>(
        `UPDATE users SET ${changes.join(', ')} WHERE id = $${values.length} RETURNING id, email, username, display_name`, values,
      );
      if (!result.rows[0]) throw new NotFoundException('User not found');
      return this.map(result.rows[0]);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Username is already taken');
      throw error;
    }
  }

  async search(username: string, currentUserId: string): Promise<PublicUserDto[]> {
    const result = await this.db.query<PublicUserRow>(
      `SELECT id, username, display_name FROM users
       WHERE id <> $1 AND position(lower($2) in lower(username)) > 0
       ORDER BY username LIMIT 25`, [currentUserId, username],
    );
    return result.rows.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name }));
  }

  private map(row: UserRow): UserDto { return { id: row.id, email: row.email, username: row.username, displayName: row.display_name }; }
  private isUniqueViolation(error: unknown): boolean { return !!error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505'; }
}
