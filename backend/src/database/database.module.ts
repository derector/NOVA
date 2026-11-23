import { Global, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createDatabasePool } from './pool';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool = createDatabasePool();

  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values as unknown[] | undefined);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
