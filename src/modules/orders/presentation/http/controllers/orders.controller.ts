import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { BEARER_AUTH } from '../../../../../core/http/setup-swagger.js';
import {
  ApiIdempotencyKey,
  IDEMPOTENT_REPLAY_HEADER,
  IdempotencyKey,
} from '../../../../../shared/presentation/http/decorators/idempotency-key.decorator.js';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { AuthenticatedUser } from '../../../../auth/application/dtos/authenticated-user.js';
import { CurrentUser } from '../../../../auth/presentation/http/decorators/current-user.decorator.js';
import { Roles } from '../../../../auth/presentation/http/decorators/roles.decorator.js';
import { UserRole } from '../../../../users/domain/value-objects/user-role.js';
import { CancelOrderUseCase } from '../../../application/use-cases/cancel-order.use-case.js';
import { GetOrderUseCase } from '../../../application/use-cases/get-order.use-case.js';
import { ListMyOrdersUseCase } from '../../../application/use-cases/list-my-orders.use-case.js';
import { PayOrderUseCase } from '../../../application/use-cases/pay-order.use-case.js';
import { PlaceOrderUseCase } from '../../../application/use-cases/place-order.use-case.js';
import { ListMyOrdersQuery } from '../dtos/list-my-orders.query.js';
import { OrderPageResponse, OrderResponse } from '../dtos/order.response.js';
import { PlaceOrderRequest } from '../dtos/place-order.request.js';

const OrderId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

const ApiOrderNotFound = () =>
  ApiNotFoundResponse({
    description: 'Pedido inexistente',
    type: ErrorResponse,
  });

const ApiOrderForbidden = () =>
  ApiForbiddenResponse({
    description: 'O pedido é de outro cliente',
    type: ErrorResponse,
  });

const ApiOrderRuleViolated = (description: string) =>
  ApiUnprocessableEntityResponse({ description, type: ErrorResponse });

@ApiTags('orders')
@ApiBearerAuth(BEARER_AUTH)
@ApiUnauthorizedResponse({
  description: 'Token ausente ou inválido',
  type: ErrorResponse,
})
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrderUseCase,
    private readonly payOrder: PayOrderUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly listMyOrders: ListMyOrdersUseCase,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiIdempotencyKey()
  @ApiOperation({
    summary: 'Reserva ingressos e cria um pedido pendente',
    description:
      'Numa única transação: trava os lotes (em ordem de id) e o cupom, valida, baixa o estoque e grava o pedido, que fica reservado por 15 minutos. Repetir a mesma Idempotency-Key devolve o pedido original com 200 e o cabeçalho Idempotent-Replayed: true.',
  })
  @ApiCreatedResponse({ description: 'Pedido criado', type: OrderResponse })
  @ApiOkResponse({
    description: 'Repetição: o pedido já existia para esta chave',
    type: OrderResponse,
  })
  @ApiBadRequestResponse({
    description: 'Corpo inválido ou Idempotency-Key ausente',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Evento ou lote inexistente',
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: 'Idempotency-Key já usada com outro conteúdo',
    type: ErrorResponse,
  })
  @ApiOrderRuleViolated(
    'Evento fora de venda, lote de outro evento ou fora do período, estoque insuficiente, limite de ingressos ou cupom inválido',
  )
  async place(
    @CurrentUser() user: AuthenticatedUser,
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: PlaceOrderRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OrderResponse> {
    const { order, replayed } = await this.placeOrder.execute(user, {
      eventId: body.eventId,
      items: body.items.map(({ batchId, quantity }) => ({ batchId, quantity })),
      couponCode: body.couponCode,
      idempotencyKey,
    });

    response.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);

    if (replayed) {
      response.setHeader(IDEMPOTENT_REPLAY_HEADER, 'true');
    }

    return OrderResponse.from(order);
  }

  // Antes de ':id': o Nest casa rotas na ordem declarada.
  @Get('me')
  @ApiOperation({
    summary: 'Pedidos do usuário autenticado',
    description: 'Mais recentes primeiro, com filtro opcional por status.',
  })
  @ApiOkResponse({ type: OrderPageResponse })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyOrdersQuery,
  ): Promise<OrderPageResponse> {
    return OrderPageResponse.from(await this.listMyOrders.execute(user, query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um pedido (dono ou admin)' })
  @ApiOkResponse({ type: OrderResponse })
  @ApiOrderForbidden()
  @ApiOrderNotFound()
  async findById(
    @CurrentUser() user: AuthenticatedUser,
    @OrderId() id: string,
  ): Promise<OrderResponse> {
    return OrderResponse.from(await this.getOrder.execute(user, id));
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirma o pagamento (simulação do gateway)',
    description:
      'Só o comprador, só pedido pendente e dentro do prazo de 15 minutos.',
  })
  @ApiOkResponse({ type: OrderResponse })
  @ApiOrderForbidden()
  @ApiOrderNotFound()
  @ApiOrderRuleViolated(
    'Pedido expirado (ORDER_EXPIRED) ou fora do status pendente',
  )
  async pay(
    @CurrentUser() user: AuthenticatedUser,
    @OrderId() id: string,
  ): Promise<OrderResponse> {
    return OrderResponse.from(await this.payOrder.execute(user, id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancela um pedido pendente (dono ou admin)',
    description:
      'Na mesma transação, devolve os ingressos aos lotes e o uso ao cupom.',
  })
  @ApiOkResponse({ type: OrderResponse })
  @ApiOrderForbidden()
  @ApiOrderNotFound()
  @ApiOrderRuleViolated('Pedido fora do status pendente')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @OrderId() id: string,
  ): Promise<OrderResponse> {
    return OrderResponse.from(await this.cancelOrder.execute(user, id));
  }
}
