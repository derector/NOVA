import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/auth.guard';
import { UsersService } from './users.service';
import { SearchUsersQuery, UpdateProfileDto } from './users.dto';

const userSchema = {
  type: 'object' as const,
  required: ['id', 'email', 'username', 'displayName'],
  properties: {
    id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' },
    username: { type: 'string' }, displayName: { type: 'string' },
    bio: { type: 'string' }, avatarUrl: { type: 'string', nullable: true }, avatarContentType: { type: 'string', nullable: true },
    coverUrl: { type: 'string', nullable: true }, coverContentType: { type: 'string', nullable: true },
  },
};
const publicUserSchema = {
  type: 'object' as const,
  required: ['id', 'username', 'displayName'],
  properties: {
    id: { type: 'string', format: 'uuid' }, username: { type: 'string' }, displayName: { type: 'string' },
    avatarUrl: { type: 'string' }, avatarContentType: { type: 'string' },
  },
};

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/api/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ operationId: 'getMe' })
  @ApiResponse({ status: 200, description: 'Authenticated private user profile.', schema: userSchema })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  getMe(@Req() req: AuthenticatedRequest) { return this.users.me(req.auth!.userId); }

  @Patch('me')
  @ApiOperation({ operationId: 'updateMe' })
  @ApiResponse({ status: 200, description: 'Updated private user profile.', schema: userSchema })
  @ApiResponse({ status: 409, description: 'Username is already taken.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  updateMe(@Req() req: AuthenticatedRequest, @Body() body: UpdateProfileDto) { return this.users.update(req.auth!.userId, body); }

  @Get('search')
  @ApiOperation({ operationId: 'searchUsers' })
  @ApiResponse({ status: 200, description: 'Public profile fields only; email is private.', schema: { type: 'array', items: publicUserSchema } })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  search(@Req() req: AuthenticatedRequest, @Query() query: SearchUsersQuery) { return this.users.search(query.username, req.auth!.userId); }
}
