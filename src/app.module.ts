import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EnvModule } from './core/config/env.module.js';
import { DatabaseModule } from './core/database/database.module.js';
import { HealthModule } from './core/health/health.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { DomainErrorFilter } from './shared/presentation/http/filters/domain-error.filter.js';

@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
