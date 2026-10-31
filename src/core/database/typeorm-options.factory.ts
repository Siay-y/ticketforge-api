import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseEnv } from '../config/env.schema.js';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..');

export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    applicationName: 'ticket-forge',
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrationsTransactionMode: 'each',
    // Globs em .js: a CLI sempre lê o build em dist, nunca o TypeScript.
    entities: [
      join(
        SOURCE_ROOT,
        'modules/**/infrastructure/persistence/**/*.orm-entity.js',
      ),
    ],
    migrations: [join(SOURCE_ROOT, 'core/database/migrations/*.js')],
    logging: env.DATABASE_LOGGING ? 'all' : ['error', 'warn', 'migration'],
    poolSize: env.DATABASE_POOL_MAX,
    connectTimeoutMS: 5_000,
    extra: {
      // Libera locks presos por queries longas ou transações esquecidas abertas.
      statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      idle_in_transaction_session_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    },
  };
}
