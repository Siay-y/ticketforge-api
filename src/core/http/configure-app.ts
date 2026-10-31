import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
} from '../../shared/presentation/http/decorators/idempotency-key.decorator.js';

export interface HttpOptions {
  apiPrefix: string;
  corsOrigins: string[];
}

export function configureApp(
  app: INestApplication,
  options: HttpOptions,
): void {
  app.use(helmet());

  app.enableCors({
    origin: options.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', IDEMPOTENCY_KEY_HEADER],
    // Deixa o JavaScript do navegador ler o aviso de resposta repetida.
    exposedHeaders: [IDEMPOTENT_REPLAY_HEADER],
    maxAge: 600,
  });

  app.setGlobalPrefix(options.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
}
