import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replayed';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const value = context
      .switchToHttp()
      .getRequest<Request>()
      .header(IDEMPOTENCY_KEY_HEADER);

    if (!value || !isUUID(value, '4')) {
      throw new BadRequestException(
        `O cabeçalho ${IDEMPOTENCY_KEY_HEADER} é obrigatório e deve ser um UUID v4`,
      );
    }

    return value.toLowerCase();
  },
);

export const ApiIdempotencyKey = () =>
  applyDecorators(
    ApiHeader({
      name: IDEMPOTENCY_KEY_HEADER,
      required: true,
      description:
        'UUID v4 gerado pelo cliente por intenção de compra. Repetir a mesma chave devolve o pedido já criado, sem reservar de novo.',
      schema: { type: 'string', format: 'uuid' },
    }),
  );
