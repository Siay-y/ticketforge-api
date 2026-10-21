import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/core/http/configure-app.js';

const ALLOWED_ORIGIN = 'http://localhost:4200';

class ReserveDto {
  @IsString()
  eventId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

@Controller('probe')
class ProbeController {
  @Post()
  reserve(@Body() dto: ReserveDto) {
    return { isDtoInstance: dto instanceof ReserveDto };
  }
}

describe('Hardening HTTP (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, { apiPrefix: 'api', corsOrigins: [ALLOWED_ORIGIN] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('aplica cabeçalhos do Helmet e oculta o X-Powered-By', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ eventId: 'evt', quantity: 1 });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('libera CORS apenas para origens permitidas', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/v1/probe')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    const denied = await request(app.getHttpServer())
      .options('/api/v1/probe')
      .set('Origin', 'https://malicioso.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('transforma o corpo na instância do DTO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ eventId: 'evt', quantity: 2 })
      .expect(201, { isDtoInstance: true });
  });

  it('rejeita propriedades fora do DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ eventId: 'evt', quantity: 2, unitPrice: 0 })
      .expect(400);

    expect(response.body.message).toContain(
      'property unitPrice should not exist',
    );
  });

  it('rejeita tipos inválidos sem conversão implícita', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ eventId: 'evt', quantity: '2' })
      .expect(400);
  });
});
