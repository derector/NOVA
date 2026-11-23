import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProfileMediaController } from './profile-media.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [UsersController, ProfileMediaController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
