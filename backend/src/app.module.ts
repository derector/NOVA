import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { DatabaseModule } from './database/database.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health.controller';
import { RequestIdMiddleware } from './common/http-errors';

@Module({ imports: [DatabaseModule, AuthModule, UsersModule, RealtimeModule, ChatsModule], controllers: [HealthController] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(RequestIdMiddleware).forRoutes('*'); }
}
