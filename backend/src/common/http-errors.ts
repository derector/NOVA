import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request { requestId?: string }

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[A-Za-z0-9._-]{1,100}$/.test(incoming) ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = error instanceof HttpException ? error.getResponse() : undefined;
    const message = typeof detail === 'string' ? detail :
      detail && typeof detail === 'object' && 'message' in detail ? (detail as { message: unknown }).message :
      status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : 'Request failed';
    response.status(status).json({ statusCode: status, message, requestId: request.requestId });
  }
}
