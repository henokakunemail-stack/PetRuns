export type QueryResultRow = Record<string, unknown>;

export interface QueryResult<R = Record<string, unknown>> {
  rows: R[];
  command: string;
  rowCount: number;
  oid: number;
  fields: unknown[];
}

export interface PoolConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

export interface DbConfig extends PoolConfig {
  mockQueryHandler?: (text: string, params?: unknown[]) => Promise<QueryResultRow[]>;
}

export interface IPool {
  options: PoolConfig;
  query<R extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<R>>;
  connect(): Promise<{
    query: (text: string, params?: unknown[]) => Promise<QueryResult<QueryResultRow>>;
    release: () => void;
  }>;
  end(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

class DefaultMockPool implements IPool {
  public options: PoolConfig;
  private mockQueryHandler?: (text: string, params?: unknown[]) => Promise<QueryResultRow[]>;

  constructor(options: PoolConfig, mockQueryHandler?: (text: string, params?: unknown[]) => Promise<QueryResultRow[]>) {
    this.options = options;
    this.mockQueryHandler = mockQueryHandler;
  }

  async query<R extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<R>> {
    if (this.mockQueryHandler) {
      const rows = (await this.mockQueryHandler(text, params)) as R[];
      return {
        rows,
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields: [],
      };
    }
    return {
      rows: [] as R[],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: [],
    };
  }

  async connect() {
    return {
      query: async (text: string, params?: unknown[]) => this.query(text, params),
      release: () => {},
    };
  }

  async end(): Promise<void> {}

  on(): void {}
}

export class DatabaseClient {
  private pool: IPool;
  private isDraining = false;
  private signalHandlersRegistered = false;

  constructor(config?: DbConfig) {
    const poolConfig: PoolConfig = {
      connectionString: config?.connectionString || process.env.DATABASE_URL,
      host: config?.host || process.env.PGHOST || '127.0.0.1',
      port: config?.port || Number(process.env.PGPORT) || 6432, // PgBouncer default port
      user: config?.user || process.env.PGUSER || 'postgres',
      password: config?.password || process.env.PGPASSWORD,
      database: config?.database || process.env.PGDATABASE || 'petmatch',
      max: config?.max ?? 50, // Capped at 50 connections per PRD
      idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 5000,
      ssl: config?.ssl ?? (process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined),
    };

    if (config?.mockQueryHandler) {
      this.pool = new DefaultMockPool(poolConfig, config.mockQueryHandler);
    } else {
      try {
        // Dynamic load when pg is present
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pg = require('pg');
        this.pool = new pg.Pool(poolConfig);
      } catch {
        this.pool = new DefaultMockPool(poolConfig);
      }
    }

    this.pool.on('error', (err: unknown) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  getPool(): IPool {
    return this.pool;
  }

  async query<R extends QueryResultRow = Record<string, unknown>, I extends unknown[] = unknown[]>(
    text: string,
    params?: I
  ): Promise<QueryResult<R>> {
    if (this.isDraining) {
      throw new Error('Database pool is shutting down. Queries rejected.');
    }
    return this.pool.query<R>(text, params);
  }

  async getClient() {
    if (this.isDraining) {
      throw new Error('Database pool is shutting down. Cannot acquire client.');
    }
    return this.pool.connect();
  }
  async transaction<T>(
    callback: (client: { query: (text: string, params?: unknown[]) => Promise<QueryResult<QueryResultRow>> }) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const res = await this.query('SELECT 1 as healthy');
      const first = res.rows?.[0];
      const healthyValue = first && typeof first === 'object' && 'healthy' in first ? first.healthy : undefined;
      return healthyValue === 1 || healthyValue === '1';
    } catch (err) {
      console.error('Database connection verification failed:', err);
      return false;
    }
  }

  async drain(): Promise<void> {
    if (this.isDraining) {
      return;
    }
    this.isDraining = true;
    try {
      await this.pool.end();
    } catch (err) {
      console.error('Error during database pool drain:', err);
      throw err;
    }
  }

  registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return;
    this.signalHandlersRegistered = true;

    const handleSignal = async (signal: string) => {
      console.log(`Received ${signal}. Gracefully draining database pool...`);
      await this.drain();
    };

    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
  }
}

export const dbClient = new DatabaseClient();
