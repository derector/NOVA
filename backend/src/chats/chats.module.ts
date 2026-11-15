import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({ imports: [AuthModule, RealtimeModule], controllers: [ChatsController], providers: [ChatsService], exports: [ChatsService] })
export class ChatsModule {}
