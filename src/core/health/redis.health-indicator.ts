import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicator: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async pingCheck<const Key extends string>(key: Key) {
    const check = this.indicator.check(key);

    try {
      await this.redis.ping();

      return check.up();
    } catch (error) {
      return check.down({ message: (error as Error).message });
    }
  }
}
