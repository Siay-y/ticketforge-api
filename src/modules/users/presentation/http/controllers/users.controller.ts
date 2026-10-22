import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BEARER_AUTH } from '../../../../../core/http/setup-swagger.js';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { AuthenticatedUser } from '../../../../auth/application/dtos/authenticated-user.js';
import { CurrentUser } from '../../../../auth/presentation/http/decorators/current-user.decorator.js';
import { Roles } from '../../../../auth/presentation/http/decorators/roles.decorator.js';
import { GetUserProfileUseCase } from '../../../application/use-cases/get-user-profile.use-case.js';
import { UserRole } from '../../../domain/value-objects/user-role.js';
import { UserResponse } from '../dtos/user.response.js';

@ApiTags('users')
@ApiBearerAuth(BEARER_AUTH)
@ApiUnauthorizedResponse({
  description: 'Token ausente ou inválido',
  type: ErrorResponse,
})
@Controller('users')
export class UsersController {
  constructor(private readonly getUserProfile: GetUserProfileUseCase) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  @ApiOkResponse({ type: UserResponse })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return UserResponse.from(await this.getUserProfile.execute(user.userId));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Perfil de qualquer usuário (somente admin)' })
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse({
    description: 'Usuário não encontrado',
    type: ErrorResponse,
  })
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponse> {
    return UserResponse.from(await this.getUserProfile.execute(id));
  }
}
