import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/auth.guard';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ChatsService } from './chats.service';
import { ChatIdParam, CreateDirectChatDto, ListMessagesQuery, SendMessageDto } from './chats.dto';

const publicUserSchema = {
  type: 'object' as const,
  required: ['id', 'username', 'displayName'],
  properties: {
    id: { type: 'string', format: 'uuid' }, username: { type: 'string' }, displayName: { type: 'string' },
  },
};
const chatSchema = {
  type: 'object' as const,
  required: ['id', 'participant', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' }, participant: publicUserSchema, updatedAt: { type: 'string', format: 'date-time' },
  },
};
const messageSchema = {
  type: 'object' as const,
  required: ['id', 'clientMessageId', 'chatId', 'senderId', 'text', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' }, clientMessageId: { type: 'string', format: 'uuid' },
    chatId: { type: 'string', format: 'uuid' }, senderId: { type: 'string', format: 'uuid' },
    text: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
    deliveredAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/api/v1/chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService, private readonly realtime: RealtimeGateway) {}

  @Get()
  @ApiOperation({ operationId: 'listChats' })
  @ApiResponse({ status: 200, description: 'Chats visible to current user.', schema: { type: 'array', items: chatSchema } })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  list(@Req() req: AuthenticatedRequest) { return this.chats.listChats(req.auth!.userId); }

  @Post('direct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'createDirectChat' })
  @ApiResponse({ status: 200, description: 'Existing or newly-created direct chat.', schema: chatSchema })
  @ApiResponse({ status: 403, description: 'Chat creation is not allowed.' })
  direct(@Req() req: AuthenticatedRequest, @Body() body: CreateDirectChatDto) { return this.chats.createDirectChat(req.auth!.userId, body.userId); }

  @Get(':chatId/messages')
  @ApiOperation({ operationId: 'listMessages' })
  @ApiResponse({ status: 200, description: 'Authorized messages after cursor; use nextCursor for REST catch-up.', schema: {
    type: 'object', required: ['items', 'nextCursor'], properties: {
      items: { type: 'array', items: messageSchema }, nextCursor: { type: 'string', format: 'uuid', nullable: true },
    },
  } })
  @ApiResponse({ status: 403, description: 'User cannot access this chat.' })
  messages(@Req() req: AuthenticatedRequest, @Param() params: ChatIdParam, @Query() query: ListMessagesQuery) {
    return this.chats.listMessages(req.auth!.userId, params.chatId, query.after, query.limit);
  }

  @Post(':chatId/messages')
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ operationId: 'createMessage' })
  @ApiResponse({ status: 201, description: 'Server-confirmed durable message (or prior message with the same key).', schema: messageSchema })
  @ApiResponse({ status: 403, description: 'User cannot send to this chat.' })
  @ApiResponse({ status: 409, description: 'Idempotency key reused with different content.' })
  async send(
    @Req() req: AuthenticatedRequest,
    @Param() params: ChatIdParam,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: SendMessageDto,
  ) {
    if (!key || !isUUID(key)) throw new BadRequestException('A valid Idempotency-Key UUID is required');
    const result = await this.chats.sendMessage(req.auth!.userId, params.chatId, key, body.text);
    if (result.created) this.realtime.emitMessage(result.message);
    return result.message;
  }
}
