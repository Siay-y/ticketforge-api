import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseEnvSchema } from '../config/env.schema.js';
import { parseEnv } from '../config/env.validation.js';
import { buildDataSourceOptions } from './typeorm-options.factory.js';

// Só para a CLI do TypeORM. Variáveis do processo têm precedência sobre o .env.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource(
  buildDataSourceOptions(parseEnv(databaseEnvSchema, process.env)),
);
