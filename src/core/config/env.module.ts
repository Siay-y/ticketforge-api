import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvService } from './env.service.js';
import { validateEnv } from './env.validation.js';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ cache: true, validate: validateEnv })],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
