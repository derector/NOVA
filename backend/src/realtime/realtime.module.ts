import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({ imports: [AuthModule, DatabaseModule], providers: [RealtimeGateway], exports: [RealtimeGateway] })
export class RealtimeModule {}
