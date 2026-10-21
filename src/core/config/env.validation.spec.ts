import { validateEnv } from './env.validation.js';

const validEnv = {
  CORS_ORIGINS: 'http://localhost:4200, https://app.ticketforge.dev',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'ticketforge',
  DATABASE_PASSWORD: 'ticketforge',
  DATABASE_NAME: 'ticketforge',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'ticketforge',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('validateEnv', () => {
  it('converte tipos e aplica valores padrão', () => {
    const env = validateEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_PORT).toBe(5432);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:4200',
      'https://app.ticketforge.dev',
    ]);
  });

  it('descarta variáveis fora do schema', () => {
    const env = validateEnv({ ...validEnv, UNRELATED: 'x' });

    expect(env).not.toHaveProperty('UNRELATED');
  });

  it('aponta cada variável obrigatória ausente', () => {
    const {
      DATABASE_PASSWORD: _password,
      JWT_ACCESS_SECRET: _secret,
      ...incomplete
    } = validEnv;

    expect(() => validateEnv(incomplete)).toThrow(
      /DATABASE_PASSWORD: variável obrigatória ausente[\s\S]*JWT_ACCESS_SECRET: variável obrigatória ausente/,
    );
  });

  it.each([
    '*',
    'http://localhost:4200/',
    'localhost:4200',
    'https://x.dev/app',
  ])('rejeita a origem CORS "%s"', (origin) => {
    expect(() => validateEnv({ ...validEnv, CORS_ORIGINS: origin })).toThrow(
      /CORS_ORIGINS: Origem inválida/,
    );
  });

  it('rejeita segredo JWT curto sem expor o valor', () => {
    const run = () => validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'curto' });

    expect(run).toThrow(/JWT_ACCESS_SECRET: Use no mínimo 32 caracteres/);
    expect(run).not.toThrow(/curto/);
  });

  it('exige segredos distintos para access e refresh token', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        JWT_REFRESH_SECRET: validEnv.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/JWT_REFRESH_SECRET: Deve ser diferente de JWT_ACCESS_SECRET/);
  });

  it('rejeita porta fora do intervalo e duração mal formatada', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        DATABASE_PORT: '70000',
        JWT_ACCESS_EXPIRES_IN: '15',
      }),
    ).toThrow(/DATABASE_PORT[\s\S]*JWT_ACCESS_EXPIRES_IN/);
  });
});
