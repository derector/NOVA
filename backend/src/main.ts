import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json } from 'express';
import type { Request } from 'express';
import { AppModule } from './app.module';
import { HttpErrorFilter, RequestWithId } from './common/http-errors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'] });
  app.use(helmet());
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (request: Request, response) => response.status(429).json({ statusCode: 429, message: 'Rate limit reached', requestId: (request as RequestWithId).requestId }),
  }));
  app.use(json({ limit: '64kb' }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }));
  app.useGlobalFilters(new HttpErrorFilter());
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('NOVA Core API').setVersion('0.1.0').setOpenAPIVersion('3.1.0').addBearerAuth().build();
    SwaggerModule.setup('/docs', app, SwaggerModule.createDocument(app, config));
  }
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error('Backend startup failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
