import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Nome do esquema de segurança, referenciado por `@ApiBearerAuth(BEARER_AUTH)`. */
export const BEARER_AUTH = 'access-token';

export function setupSwagger(app: INestApplication, path: string): void {
  const config = new DocumentBuilder()
    .setTitle('TicketForge API')
    .setDescription('Plataforma de bilhetagem e venda de ingressos em lote.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token JWT enviado no cabeçalho Authorization.',
      },
      BEARER_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(path, app, document, {
    jsonDocumentUrl: `${path}/openapi.json`,
    swaggerOptions: { persistAuthorization: true },
  });
}
