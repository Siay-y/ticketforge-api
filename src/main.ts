import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvService } from './core/config/env.service.js';
import { configureApp } from './core/http/configure-app.js';
import { setupSwagger } from './core/http/setup-swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);

  configureApp(app, {
    apiPrefix: env.get('API_PREFIX'),
    corsOrigins: env.get('CORS_ORIGINS'),
  });

  if (env.get('SWAGGER_ENABLED')) {
    setupSwagger(app, env.get('SWAGGER_PATH'));
  }

  await app.listen(env.get('PORT'));

  Logger.log(`TicketForge ouvindo em ${await app.getUrl()}`, 'Bootstrap');
}

await bootstrap();
