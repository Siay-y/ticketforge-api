import { Module } from '@nestjs/common';
import { EnvModule } from './core/config/env.module.js';
import { DatabaseModule } from './core/database/database.module.js';
import { HealthModule } from './core/health/health.module.js';

@Module({
  imports: [EnvModule, DatabaseModule, HealthModule],
})
export class AppModule {}
