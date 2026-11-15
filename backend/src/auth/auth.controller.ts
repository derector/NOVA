import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from './auth.guard';
import { RefreshDto, RequestCodeDto, TokenResponse, VerifyCodeDto } from './auth.dto';
import type { Response } from 'express';

@ApiTags('auth')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ operationId: 'requestEmailCode' })
  @ApiResponse({ status: 202, description: 'Code request accepted without exposing account enumeration.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit reached.' })
  @ApiResponse({ status: 503, description: 'Email delivery is not configured or temporarily unavailable.' })
  async requestCode(@Body() body: RequestCodeDto, @Ip() ip: string): Promise<{ accepted: true }> {
    await this.auth.requestCode(body.email, ip || 'unknown');
    return { accepted: true };
  }

  @Get('telegram/start')
  telegramStart(): { url: string } { return this.auth.telegramStart(); }

  @Get('telegram/callback')
  async telegramCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string | undefined, @Res() response: Response): Promise<void> {
    response.redirect(await this.auth.telegramCallback(code, state, error));
  }

  @Post('telegram/exchange')
  @HttpCode(HttpStatus.OK)
  telegramExchange(@Body('handoff') handoff: string) { return this.auth.telegramExchange(handoff); }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'verifyEmailCode' })
  @ApiResponse({ status: 200, description: 'Code accepted; access and refresh tokens issued.', type: TokenResponse })
  @ApiResponse({ status: 400, description: 'Invalid, expired or already-used code.' })
  @ApiResponse({ status: 429, description: 'Rate limit reached.' })
  verifyCode(@Body() body: VerifyCodeDto) { return this.auth.verifyCode(body.email, body.code); }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'refreshSession' })
  @ApiResponse({ status: 200, description: 'Access and refresh tokens rotated.', type: TokenResponse })
  @ApiResponse({ status: 401, description: 'Invalid, expired or revoked refresh token.' })
  refresh(@Body() body: RefreshDto) { return this.auth.refresh(body.refreshToken); }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'logout' })
  @ApiResponse({ status: 204, description: 'Current refresh session revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.logout(request.auth!.sessionId);
  }
}
