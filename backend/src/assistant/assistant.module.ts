import { Body, Controller, Get, Header, HttpCode, Module, Post, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { ChatDto, SpeechDto } from './assistant.dto';
import { audioLimit, AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/api/v1/assistant')
class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() { return this.assistant.status(); }

  @Post('chat')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  chat(@Req() request: AuthenticatedRequest, @Body() body: ChatDto) {
    return this.assistant.chat(request.auth!.userId, body.messages);
  }

  @Post('transcribe')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: audioLimit, files: 1, fields: 0, parts: 2 } }))
  transcribe(@Req() request: AuthenticatedRequest, @UploadedFile() audio?: { buffer: Buffer }) {
    return this.assistant.transcribe(request.auth!.userId, audio?.buffer);
  }

  @Post('speech')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async speech(@Req() request: AuthenticatedRequest, @Body() body: SpeechDto) {
    const bytes = await this.assistant.speech(request.auth!.userId, body);
    return new StreamableFile(bytes, { type: 'audio/mpeg', length: bytes.length });
  }
}

@Module({ imports: [AuthModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
