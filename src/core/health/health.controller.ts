import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../shared/presentation/http/decorators/public.decorator.js';
import { RedisHealthIndicator } from './redis.health-indicator.js';

@ApiTags('health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Estado da API, do PostgreSQL e do Redis' })
  check() {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 1_500 }),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
