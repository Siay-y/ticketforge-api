import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitOfWork } from '../../shared/application/unit-of-work.js';
import {
  TransactionContext,
  TypeOrmUnitOfWork,
} from '../../shared/infrastructure/persistence/typeorm/typeorm-unit-of-work.js';
import { databaseEnvSchema } from '../config/env.schema.js';
import { EnvService } from '../config/env.service.js';
import { buildDataSourceOptions } from './typeorm-options.factory.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        ...buildDataSourceOptions(env.pick(databaseEnvSchema)),
        // Cada módulo registra as próprias entidades via forFeature.
        entities: [],
        autoLoadEntities: true,
      }),
    }),
  ],
  providers: [
    { provide: UnitOfWork, useClass: TypeOrmUnitOfWork },
    TransactionContext,
  ],
  exports: [UnitOfWork, TransactionContext],
})
export class DatabaseModule {}
