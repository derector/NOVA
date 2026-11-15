import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDirectChatDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class ChatIdParam {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  chatId!: string;
}

export class MessageIdParam extends ChatIdParam {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageId!: string;
}

export class ListMessagesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  after?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class SendMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text!: string;
}

export class NotificationPreferenceDto {
  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'UTC mute expiry; null unmutes immediately.' })
  @IsOptional()
  @IsDateString()
  mutedUntil?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  previewEnabled?: boolean;
}

export class IdempotencyHeader {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  key!: string;
}
