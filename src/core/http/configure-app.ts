import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';

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
    allowedHeaders: ['Authorization', 'Content-Type'],
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
