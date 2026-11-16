import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePresenceService } from './realtime-presence.service';

@Module({ imports: [AuthModule, DatabaseModule], providers: [RealtimeGateway, RealtimePresenceService], exports: [RealtimeGateway] })
export class RealtimeModule {}
