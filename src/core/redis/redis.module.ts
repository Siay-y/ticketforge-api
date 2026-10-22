import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { redisEnvSchema } from '../config/env.schema.js';
import { EnvService } from '../config/env.service.js';
import { REDIS_CLIENT } from './redis.constants.js';

const logger = new Logger('Redis');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [EnvService],
      useFactory: async (env: EnvService): Promise<Redis> => {
        const config = env.pick(redisEnvSchema);
        const client = new Redis({
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD,
          db: config.REDIS_DB,
          connectionName: 'ticket-forge-api',
          lazyConnect: true,
          // Sem fila offline: com o Redis fora, o comando falha na hora em vez de
          // segurar a requisição. A checagem de sessão depende disso para falhar fechada.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 5_000,
          commandTimeout: 2_000,
        });

        // Sem listener, o ioredis despeja cada falha de reconexão como "Unhandled error event".
        client.on('error', (error: NodeJS.ErrnoException) =>
          logger.error(error.code ?? error.message),
        );

        // Conecta no boot: Redis indisponível impede a API de subir.
        await client.connect();

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }
}
