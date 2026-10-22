import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { BEARER_AUTH } from '../../../../../core/http/setup-swagger.js';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import { UserRole } from '../../../../users/domain/value-objects/user-role.js';
import { Roles } from '../../../../auth/presentation/http/decorators/roles.decorator.js';

/**
 * Restringe a ADMIN e ORGANIZER e documenta as respostas comuns às rotas de gestão.
 * O 403 também cobre organizador tentando alterar evento de outro (ownership).
 */
export const ApiManageEvent = ({ withEvent = true } = {}) =>
  applyDecorators(
    Roles(UserRole.ORGANIZER, UserRole.ADMIN),
    ApiBearerAuth(BEARER_AUTH),
    ApiBadRequestResponse({
      description: 'Entrada malformada',
      type: ErrorResponse,
    }),
    ApiUnauthorizedResponse({
      description: 'Token ausente ou inválido',
      type: ErrorResponse,
    }),
    ApiUnprocessableEntityResponse({
      description:
        'Regra de negócio violada (capacidade, datas, status ou estoque)',
      type: ErrorResponse,
    }),
    ...(withEvent
      ? [
          ApiNotFoundResponse({
            description: 'Evento ou lote inexistente (ou removido)',
            type: ErrorResponse,
          }),
        ]
      : []),
  );
