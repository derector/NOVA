import { BadRequestException, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/auth.guard';
import { MediaSlot, profileMediaLimit } from './profile-media';
import { UsersService } from './users.service';

@Controller('/api/v1/users')
export class ProfileMediaController {
  constructor(private readonly users: UsersService) {}

  @Post('me/media/:slot')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: profileMediaLimit, files: 1, fields: 0, parts: 2 } }))
  upload(@Req() req: AuthenticatedRequest, @Param('slot') slot: string, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer.length) throw new BadRequestException('Upload one image or video');
    return this.users.putMedia(req.auth!.userId, this.slot(slot), file.buffer);
  }

  @Delete('me/media/:slot')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: AuthenticatedRequest, @Param('slot') slot: string) {
    return this.users.removeMedia(req.auth!.userId, this.slot(slot));
  }

  @Get('media/:id')
  async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: Request, @Res() res: Response) {
    const { data, content_type: contentType } = await this.users.getMedia(id);
    res.set({
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=300, immutable',
      'Accept-Ranges': 'bytes',
    });
    const range = req.range(data.length);
    if (range === -1 || (Array.isArray(range) && (range.type !== 'bytes' || range.length !== 1))) {
      res.status(416).set('Content-Range', `bytes */${data.length}`).end();
    } else if (Array.isArray(range)) {
      const { start, end } = range[0];
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${data.length}`).set('Content-Length', String(end - start + 1)).end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1));
    } else {
      res.set('Content-Length', String(data.length)).end(req.method === 'HEAD' ? undefined : data);
    }
  }

  private slot(slot: string): MediaSlot {
    if (slot !== 'avatar' && slot !== 'cover') throw new BadRequestException('Unknown media slot');
    return slot;
  }
}
