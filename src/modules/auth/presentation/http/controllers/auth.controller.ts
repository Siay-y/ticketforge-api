import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BEARER_AUTH } from '../../../../../core/http/setup-swagger.js';
import { Public } from '../../../../../shared/presentation/http/decorators/public.decorator.js';
import { ErrorResponse } from '../../../../../shared/presentation/http/error.response.js';
import type { AuthenticatedUser } from '../../../application/dtos/authenticated-user.js';
import { LoginUseCase } from '../../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case.js';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case.js';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { AuthTokensResponse } from '../dtos/auth-tokens.response.js';
import { LoginRequest } from '../dtos/login.request.js';
import { RefreshTokenRequest } from '../dtos/refresh-token.request.js';
import { RegisterRequest } from '../dtos/register.request.js';

const ApiInvalidBody = () =>
  ApiBadRequestResponse({ description: 'Corpo inválido', type: ErrorResponse });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticate: LoginUseCase,
    private readonly rotateTokens: RefreshTokenUseCase,
    private readonly endSession: LogoutUseCase,
  ) {}

  @Public()
  @Post('register')
  @ApiInvalidBody()
  @ApiOperation({
    summary: 'Cadastra um cliente e abre a primeira sessão',
    description: 'Todo cadastro recebe o papel `customer`.',
  })
  @ApiCreatedResponse({ type: AuthTokensResponse })
  @ApiConflictResponse({
    description: 'E-mail já cadastrado',
    type: ErrorResponse,
  })
  async register(@Body() body: RegisterRequest): Promise<AuthTokensResponse> {
    return AuthTokensResponse.from(await this.registerUser.execute(body));
  }

  @Public()
  @Post('login')
  @ApiInvalidBody()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentica por e-mail e senha e abre uma nova sessão',
  })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiUnauthorizedResponse({
    description: 'E-mail ou senha inválidos',
    type: ErrorResponse,
  })
  async login(@Body() body: LoginRequest): Promise<AuthTokensResponse> {
    return AuthTokensResponse.from(await this.authenticate.execute(body));
  }

  @Public()
  @Post('refresh')
  @ApiInvalidBody()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Troca o refresh token por um novo par (rotação)',
    description:
      'O refresh token enviado deixa de valer. Reapresentar um token já trocado encerra a sessão inteira.',
  })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiUnauthorizedResponse({
    description: 'Token inválido, expirado, revogado ou reutilizado',
    type: ErrorResponse,
  })
  async refresh(
    @Body() body: RefreshTokenRequest,
  ): Promise<AuthTokensResponse> {
    return AuthTokensResponse.from(
      await this.rotateTokens.execute(body.refreshToken),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({
    summary: 'Encerra a sessão atual',
    description:
      'Access e refresh tokens da sessão deixam de valer imediatamente.',
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente ou inválido',
    type: ErrorResponse,
  })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.endSession.execute(user);
  }
}
