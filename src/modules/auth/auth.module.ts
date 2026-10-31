import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { SessionStore } from './application/ports/session-store.js';
import { TokenService } from './application/ports/token-service.js';
import { SessionTokenIssuer } from './application/services/session-token-issuer.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case.js';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case.js';
import { ValidateAccessTokenUseCase } from './application/use-cases/validate-access-token.use-case.js';
import { JwtTokenService } from './infrastructure/jwt/jwt-token.service.js';
import { RedisSessionStore } from './infrastructure/redis/redis-session.store.js';
import { AuthController } from './presentation/http/controllers/auth.controller.js';
import { JwtAuthGuard } from './presentation/http/guards/jwt-auth.guard.js';
import { RolesGuard } from './presentation/http/guards/roles.guard.js';

@Module({
  // Segredo e validade vão em cada assinatura.
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: TokenService, useClass: JwtTokenService },
    { provide: SessionStore, useClass: RedisSessionStore },
    SessionTokenIssuer,
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    ValidateAccessTokenUseCase,
    // Ordem importa: autenticação antes de autorização.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
