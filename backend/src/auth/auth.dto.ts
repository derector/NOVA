import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class VerifyCodeDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 6, maxLength: 12, pattern: '^\\d{6,12}$' })
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  @Matches(/^\d{6,12}$/)
  code!: string;
}

export class RefreshDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken!: string;
}

export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'email' })
  email!: string;
  @ApiProperty()
  username!: string;
  @ApiProperty()
  displayName!: string;
}

export class TokenResponse {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty({ format: 'date-time' })
  accessTokenExpiresAt!: string;
  @ApiProperty()
  refreshToken!: string;
  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}
