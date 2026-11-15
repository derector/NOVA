import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/auth.guard';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ChatsService } from './chats.service';
import { ChatIdParam, CreateDirectChatDto, ListMessagesQuery, MessageIdParam, NotificationPreferenceDto, SendMessageDto } from './chats.dto';

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
    id: { type: 'string', format: 'uuid' }, participant: publicUserSchema, updatedAt: { type: 'string', format: 'date-time' }, unreadCount: { type: 'integer' }, mutedUntil: { type: 'string', format: 'date-time', nullable: true },
  },
};
const messageSchema = {
  type: 'object' as const,
  required: ['id', 'clientMessageId', 'chatId', 'senderId', 'text', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' }, clientMessageId: { type: 'string', format: 'uuid' },
    chatId: { type: 'string', format: 'uuid' }, senderId: { type: 'string', format: 'uuid' },
    text: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
    deliveredAt: { type: 'string', format: 'date-time', nullable: true }, readAt: { type: 'string', format: 'date-time', nullable: true },
    editedAt: { type: 'string', format: 'date-time', nullable: true }, deletedAt: { type: 'string', format: 'date-time', nullable: true },
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

  @Post(':chatId/notifications')
  @HttpCode(HttpStatus.OK)
  async notifications(@Req() req: AuthenticatedRequest, @Param() params: ChatIdParam, @Body() body: NotificationPreferenceDto) {
    return this.chats.updateNotificationPreference(req.auth!.userId, params.chatId, body.mutedUntil ?? null, body.previewEnabled ?? true);
  }

  @Post(':chatId/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Req() req: AuthenticatedRequest, @Param() params: ChatIdParam) {
    const messageIds = await this.chats.markRead(req.auth!.userId, params.chatId);
    this.realtime.emitRead({ chatId: params.chatId, userId: req.auth!.userId, messageIds });
    return { chatId: params.chatId, messageIds };
  }

  @Patch(':chatId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async edit(@Req() req: AuthenticatedRequest, @Param() params: MessageIdParam, @Body() body: SendMessageDto) {
    const message = await this.chats.editMessage(req.auth!.userId, params.chatId, params.messageId, body.text);
    this.realtime.emitMessageUpdated(message);
    return message;
  }

  @Delete(':chatId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: AuthenticatedRequest, @Param() params: MessageIdParam) {
    const message = await this.chats.deleteMessage(req.auth!.userId, params.chatId, params.messageId);
    this.realtime.emitMessageDeleted(message);
    return message;
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
