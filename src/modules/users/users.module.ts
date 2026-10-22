import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './application/ports/password-hasher.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case.js';
import { VerifyCredentialsUseCase } from './application/use-cases/verify-credentials.use-case.js';
import { UserRepository } from './domain/repositories/user.repository.js';
import { ScryptPasswordHasher } from './infrastructure/crypto/scrypt-password-hasher.js';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-user.repository.js';
import { UsersController } from './presentation/http/controllers/users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: PasswordHasher, useFactory: () => new ScryptPasswordHasher() },
    CreateUserUseCase,
    VerifyCredentialsUseCase,
    GetUserProfileUseCase,
  ],
  // API pública do módulo: casos de uso, nunca o repositório.
  exports: [CreateUserUseCase, VerifyCredentialsUseCase, GetUserProfileUseCase],
})
export class UsersModule {}
