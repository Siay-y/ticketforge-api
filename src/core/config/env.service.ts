import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';
import type { Env } from './env.schema.js';

@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  /** Extrai o recorte de variáveis descrito por um dos schemas de `env.schema.ts`. */
  pick<S extends z.ZodObject>(schema: S): z.output<S> {
    const entries = Object.keys(schema.shape).map((key) => [
      key,
      this.get(key as keyof Env),
    ]);

    return Object.fromEntries(entries) as z.output<S>;
  }
}
