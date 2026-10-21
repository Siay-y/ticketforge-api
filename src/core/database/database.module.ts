import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseEnvSchema } from '../config/env.schema.js';
import { EnvService } from '../config/env.service.js';
import { buildDataSourceOptions } from './typeorm-options.factory.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        ...buildDataSourceOptions(env.pick(databaseEnvSchema)),
        // Em runtime cada módulo registra as próprias entidades via forFeature.
        entities: [],
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
