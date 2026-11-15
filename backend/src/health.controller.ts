import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from './database/database.module';

@ApiTags('health')
@Controller('/api/v1/health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @ApiOperation({ operationId: 'health' })
  async health(): Promise<{ status: 'ok'; database: 'ready' }> {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', database: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
