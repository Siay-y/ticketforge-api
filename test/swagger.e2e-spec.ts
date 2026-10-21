import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/core/http/configure-app.js';
import { BEARER_AUTH, setupSwagger } from '../src/core/http/setup-swagger.js';

@ApiBearerAuth(BEARER_AUTH)
@Controller('tickets')
class ProtectedController {
  @Get()
  list() {
    return [];
  }
}

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProtectedController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, {
      apiPrefix: 'api',
      corsOrigins: ['http://localhost:4200'],
    });
    setupSwagger(app, 'docs');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documenta o esquema Bearer JWT e o aplica nas rotas anotadas', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);

    expect(body.components.securitySchemes[BEARER_AUTH]).toEqual(
      expect.objectContaining({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }),
    );
    expect(body.paths['/api/v1/tickets'].get.security).toEqual([
      { [BEARER_AUTH]: [] },
    ]);
  });

  it('serve a interface sem scripts inline bloqueados pelo CSP do Helmet', async () => {
    const { text } = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(text).not.toMatch(/<script>(?!\s*<\/script>)/);
    await request(app.getHttpServer())
      .get('/docs/swagger-ui-init.js')
      .expect(200);
  });
});
