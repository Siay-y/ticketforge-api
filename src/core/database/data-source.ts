import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseEnvSchema } from '../config/env.schema.js';
import { parseEnv } from '../config/env.validation.js';
import { buildDataSourceOptions } from './typeorm-options.factory.js';

// Ponto de entrada exclusivo da CLI do TypeORM, fora do container do Nest.
// Variáveis já definidas no processo (CI, container) têm precedência sobre o .env.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource(
  buildDataSourceOptions(parseEnv(databaseEnvSchema, process.env)),
);
