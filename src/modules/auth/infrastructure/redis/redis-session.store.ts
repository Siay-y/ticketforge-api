import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../../core/redis/redis.constants.js';
import type {
  RotateSessionInput,
  RotationResult,
  Session,
  SessionStore,
} from '../../application/ports/session-store.js';

const sessionKey = (sessionId: string): string => `auth:session:${sessionId}`;

// Compare-and-swap atômico: entre ler e trocar o token ativo nenhuma outra
// requisição executa. Token divergente significa reuso e encerra a sessão.
const ROTATE_SCRIPT = `
local current = redis.call('HGET', KEYS[1], 'tokenId')
if not current then
  return 0
end
if current ~= ARGV[1] then
  redis.call('DEL', KEYS[1])
  return -1
end
redis.call('HSET', KEYS[1], 'tokenId', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`;

const ROTATION_RESULTS: Record<number, RotationResult> = {
  1: 'rotated',
  0: 'not_found',
  [-1]: 'reused',
};

@Injectable()
export class RedisSessionStore implements SessionStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(session: Session, ttlSeconds: number): Promise<void> {
    const key = sessionKey(session.sessionId);
    const results = await this.redis
      .multi()
      .hset(key, {
        userId: session.userId,
        tokenId: session.tokenId,
        createdAt: new Date().toISOString(),
      })
      .expire(key, ttlSeconds)
      .exec();

    const failure = results?.find(([error]) => error)?.[0];

    if (!results || failure) {
      throw failure ?? new Error('Transação de criação de sessão abortada');
    }
  }

  async rotate(
    input: RotateSessionInput,
    ttlSeconds: number,
  ): Promise<RotationResult> {
    const outcome = (await this.redis.eval(
      ROTATE_SCRIPT,
      1,
      sessionKey(input.sessionId),
      input.expectedTokenId,
      input.nextTokenId,
      ttlSeconds,
    )) as number;

    const result = ROTATION_RESULTS[outcome];

    if (!result) {
      throw new Error(`Resultado inesperado na rotação de sessão: ${outcome}`);
    }

    return result;
  }

  async isActive(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(sessionKey(sessionId))) === 1;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(sessionKey(sessionId));
  }
}
