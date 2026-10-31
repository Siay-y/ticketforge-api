import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../../shared/presentation/http/decorators/public.decorator.js';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { AuthenticatedUser } from '../../../../auth/application/dtos/authenticated-user.js';
import { CurrentUser } from '../../../../auth/presentation/http/decorators/current-user.decorator.js';
import { AddTicketBatchUseCase } from '../../../application/use-cases/add-ticket-batch.use-case.js';
import { CancelEventUseCase } from '../../../application/use-cases/cancel-event.use-case.js';
import { CreateEventUseCase } from '../../../application/use-cases/create-event.use-case.js';
import { DeleteEventUseCase } from '../../../application/use-cases/delete-event.use-case.js';
import { GetPublishedEventUseCase } from '../../../application/use-cases/get-published-event.use-case.js';
import { ListMyEventsUseCase } from '../../../application/use-cases/list-my-events.use-case.js';
import { ListPublishedEventsUseCase } from '../../../application/use-cases/list-published-events.use-case.js';
import { PublishEventUseCase } from '../../../application/use-cases/publish-event.use-case.js';
import { UpdateEventUseCase } from '../../../application/use-cases/update-event.use-case.js';
import { UpdateTicketBatchUseCase } from '../../../application/use-cases/update-ticket-batch.use-case.js';
import { ApiManageEvent } from '../decorators/api-manage-event.decorator.js';
import {
  EventDetailsResponse,
  EventPageResponse,
  TicketBatchResponse,
} from '../dtos/event.response.js';
import {
  CreateEventRequest,
  UpdateEventRequest,
} from '../dtos/event.request.js';
import { ListEventsQuery } from '../dtos/list-events.query.js';
import { ListMyEventsQuery } from '../dtos/list-my-events.query.js';
import {
  CreateTicketBatchRequest,
  UpdateTicketBatchRequest,
} from '../dtos/ticket-batch.request.js';

const EventId = () => Param('id', new ParseUUIDPipe({ version: '4' }));

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly listPublished: ListPublishedEventsUseCase,
    private readonly getPublished: GetPublishedEventUseCase,
    private readonly createEvent: CreateEventUseCase,
    private readonly updateEvent: UpdateEventUseCase,
    private readonly publishEvent: PublishEventUseCase,
    private readonly cancelEvent: CancelEventUseCase,
    private readonly deleteEvent: DeleteEventUseCase,
    private readonly addBatch: AddTicketBatchUseCase,
    private readonly updateBatch: UpdateTicketBatchUseCase,
    private readonly listMyEvents: ListMyEventsUseCase,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lista eventos publicados',
    description:
      'Paginado, ordenado pela data do evento. Sem `from`, mostra só eventos futuros.',
  })
  @ApiOkResponse({ type: EventPageResponse })
  @ApiBadRequestResponse({
    description: 'Paginação, datas ou termo de busca inválidos',
    type: ErrorResponse,
  })
  async list(@Query() query: ListEventsQuery): Promise<EventPageResponse> {
    return EventPageResponse.from(await this.listPublished.execute(query));
  }

  // Antes de ':slug': o Nest casa rotas na ordem declarada.
  @Get('me')
  @ApiManageEvent({ withEvent: false })
  @ApiOperation({
    summary: 'Eventos do organizador autenticado, em qualquer status',
    description:
      'Inclui rascunhos e cancelados; removidos ficam de fora. Mais recentes primeiro.',
  })
  @ApiOkResponse({ type: EventPageResponse })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyEventsQuery,
  ): Promise<EventPageResponse> {
    return EventPageResponse.from(await this.listMyEvents.execute(user, query));
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Detalhe público de um evento publicado, com lotes',
  })
  @ApiOkResponse({ type: EventDetailsResponse })
  @ApiNotFoundResponse({
    description: 'Inexistente, em rascunho, cancelado ou removido',
    type: ErrorResponse,
  })
  async findBySlug(@Param('slug') slug: string): Promise<EventDetailsResponse> {
    return EventDetailsResponse.from(await this.getPublished.execute(slug));
  }

  @Post()
  @ApiManageEvent({ withEvent: false })
  @ApiOperation({
    summary: 'Cria um evento em rascunho, com lotes iniciais opcionais',
    description:
      'Evento e lotes são gravados numa única transação. O dono é sempre o usuário autenticado.',
  })
  @ApiCreatedResponse({ type: EventDetailsResponse })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateEventRequest,
  ): Promise<EventDetailsResponse> {
    return EventDetailsResponse.from(
      await this.createEvent.execute(user, body),
    );
  }

  @Patch(':id')
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Altera dados do evento',
    description:
      'O slug não muda com o título, para não quebrar links já divulgados.',
  })
  @ApiOkResponse({ type: EventDetailsResponse })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
    @Body() body: UpdateEventRequest,
  ): Promise<EventDetailsResponse> {
    return EventDetailsResponse.from(
      await this.updateEvent.execute(user, id, body),
    );
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Publica um evento em rascunho',
    description: 'Exige ao menos um lote e data do evento no futuro.',
  })
  @ApiOkResponse({ type: EventDetailsResponse })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
  ): Promise<EventDetailsResponse> {
    return EventDetailsResponse.from(await this.publishEvent.execute(user, id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiManageEvent()
  @ApiOperation({ summary: 'Cancela um evento em rascunho ou publicado' })
  @ApiOkResponse({ type: EventDetailsResponse })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
  ): Promise<EventDetailsResponse> {
    return EventDetailsResponse.from(await this.cancelEvent.execute(user, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Remove (soft delete) um evento em rascunho ou cancelado',
    description: 'Evento publicado precisa ser cancelado antes.',
  })
  @ApiNoContentResponse({ description: 'Evento removido' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
  ): Promise<void> {
    await this.deleteEvent.execute(user, id);
  }

  @Post(':id/batches')
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Adiciona um lote ao evento',
    description:
      'A soma dos lotes não pode passar de maxCapacity e as vendas devem terminar até a data do evento.',
  })
  @ApiCreatedResponse({ type: TicketBatchResponse })
  async createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
    @Body() body: CreateTicketBatchRequest,
  ): Promise<TicketBatchResponse> {
    return TicketBatchResponse.from(
      await this.addBatch.execute(user, id, body),
    );
  }

  @Patch(':id/batches/:batchId')
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Altera um lote',
    description:
      'totalQuantity não pode ficar abaixo do já vendido; a parte disponível é recalculada.',
  })
  @ApiParam({ name: 'batchId', description: 'UUID do lote' })
  @ApiOkResponse({ type: TicketBatchResponse })
  async editBatch(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() id: string,
    @Param('batchId', new ParseUUIDPipe({ version: '4' })) batchId: string,
    @Body() body: UpdateTicketBatchRequest,
  ): Promise<TicketBatchResponse> {
    return TicketBatchResponse.from(
      await this.updateBatch.execute(user, id, batchId, body),
    );
  }
}
