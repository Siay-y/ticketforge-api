import type { z } from 'zod';
import { envSchema, type Env } from './env.schema.js';

export function parseEnv<S extends z.ZodType>(
  schema: S,
  raw: Record<string, unknown>,
): z.output<S> {
  const result = schema.safeParse(raw);

  if (result.success) {
    return result.data;
  }

  // Lista apenas nomes e motivos, nunca os valores, para não vazar segredos no log.
  const problems = result.error.issues.map((issue) => {
    const variable = String(issue.path[0]);
    const reason =
      raw[variable] === undefined
        ? 'variável obrigatória ausente'
        : issue.message;

    return `  - ${variable}: ${reason}`;
  });

  throw new Error(`Configuração de ambiente inválida:\n${problems.join('\n')}`);
}

export const validateEnv = (raw: Record<string, unknown>): Env =>
  parseEnv(envSchema, raw);
