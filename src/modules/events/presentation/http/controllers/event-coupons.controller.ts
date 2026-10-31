import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { AuthenticatedUser } from '../../../../auth/application/dtos/authenticated-user.js';
import { CurrentUser } from '../../../../auth/presentation/http/decorators/current-user.decorator.js';
import { CreateCouponUseCase } from '../../../application/use-cases/create-coupon.use-case.js';
import { ListCouponsUseCase } from '../../../application/use-cases/list-coupons.use-case.js';
import { ApiManageEvent } from '../decorators/api-manage-event.decorator.js';
import { CreateCouponRequest } from '../dtos/coupon.request.js';
import { CouponResponse } from '../dtos/coupon.response.js';

const EventId = () => Param('eventId', new ParseUUIDPipe({ version: '4' }));

@ApiTags('coupons')
@ApiForbiddenResponse({
  description: 'Papel sem permissão ou evento de outro organizador',
  type: ErrorResponse,
})
@Controller('events/:eventId/coupons')
export class EventCouponsController {
  constructor(
    private readonly createCoupon: CreateCouponUseCase,
    private readonly listCoupons: ListCouponsUseCase,
  ) {}

  @Post()
  @ApiManageEvent()
  @ApiOperation({
    summary: 'Cria um cupom de desconto para o evento',
    description:
      'Só o dono do evento ou um admin. O código é único por evento, sem diferenciar maiúsculas.',
  })
  @ApiCreatedResponse({ type: CouponResponse })
  @ApiConflictResponse({
    description: 'Código já usado neste evento',
    type: ErrorResponse,
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() eventId: string,
    @Body() body: CreateCouponRequest,
  ): Promise<CouponResponse> {
    return CouponResponse.from(
      await this.createCoupon.execute(user, eventId, {
        code: body.code,
        discountType: body.discountType,
        discountValue: body.discountValue,
        maxUses: body.maxUses ?? null,
        expiresAt: body.expiresAt,
      }),
    );
  }

  @Get()
  @ApiManageEvent()
  @ApiOperation({ summary: 'Lista os cupons do evento, com contagem de uso' })
  @ApiOkResponse({ type: [CouponResponse] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @EventId() eventId: string,
  ): Promise<CouponResponse[]> {
    const coupons = await this.listCoupons.execute(user, eventId);

    return coupons.map((coupon) => CouponResponse.from(coupon));
  }
}
