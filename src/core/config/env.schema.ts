import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);

const positiveInt = z.coerce.number().int().positive();

const flag = z.stringbool().default(false);

const requiredString = z.string().trim().min(1);

const secret = z.string().min(32, 'Use no mínimo 32 caracteres');

const SECONDS_PER_UNIT = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

// Em segundos: vira o `exp` do JWT e o TTL da sessão.
const durationInSeconds = z
  .string()
  .regex(/^[1-9]\d*[smhd]$/, 'Use o formato <número><s|m|h|d>, ex.: 15m')
  .transform((value) => {
    const unit = value.at(-1) as keyof typeof SECONDS_PER_UNIT;

    return Number.parseInt(value, 10) * SECONDS_PER_UNIT[unit];
  });

const isOrigin = (value: string): boolean =>
  URL.canParse(value) && new URL(value).origin === value;

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(isOrigin, {
          error: (issue) => `Origem inválida: "${String(issue.input)}"`,
        }),
      )
      .min(1, 'Informe ao menos uma origem'),
  );

export const appEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: port.default(3000),
  API_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen')
    .default('api'),
  CORS_ORIGINS: originList,
  SWAGGER_ENABLED: flag,
  SWAGGER_PATH: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen')
    .default('docs'),
});

export const databaseEnvSchema = z.object({
  DATABASE_HOST: requiredString,
  DATABASE_PORT: port,
  DATABASE_USER: requiredString,
  DATABASE_PASSWORD: requiredString,
  DATABASE_NAME: requiredString,
  DATABASE_SSL: flag,
  DATABASE_LOGGING: flag,
  DATABASE_POOL_MAX: positiveInt.max(100).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: positiveInt.default(10_000),
});

export const redisEnvSchema = z.object({
  REDIS_HOST: requiredString,
  REDIS_PORT: port,
  REDIS_PASSWORD: requiredString,
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
});

export const jwtEnvSchema = z.object({
  JWT_ACCESS_SECRET: secret,
  JWT_ACCESS_EXPIRES_IN: durationInSeconds,
  JWT_REFRESH_SECRET: secret,
  JWT_REFRESH_EXPIRES_IN: durationInSeconds,
});

export const envSchema = z
  .object({
    ...appEnvSchema.shape,
    ...databaseEnvSchema.shape,
    ...redisEnvSchema.shape,
    ...jwtEnvSchema.shape,
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    error: 'Deve ser diferente de JWT_ACCESS_SECRET',
  })
  .refine((env) => env.JWT_REFRESH_EXPIRES_IN > env.JWT_ACCESS_EXPIRES_IN, {
    path: ['JWT_REFRESH_EXPIRES_IN'],
    error: 'Deve ser maior que JWT_ACCESS_EXPIRES_IN',
  });

export type Env = z.output<typeof envSchema>;
export type DatabaseEnv = z.output<typeof databaseEnvSchema>;
export type RedisEnv = z.output<typeof redisEnvSchema>;
export type JwtEnv = z.output<typeof jwtEnvSchema>;
