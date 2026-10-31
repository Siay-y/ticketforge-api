import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../../../../shared/infrastructure/persistence/typeorm/postgres-errors.js';
import type { User } from '../../../../domain/entities/user.js';
import { EmailAlreadyInUseError } from '../../../../domain/errors/email-already-in-use.error.js';
import type { UserRepository } from '../../../../domain/repositories/user.repository.js';
import type { Email } from '../../../../domain/value-objects/email.js';
import {
  USERS_EMAIL_UNIQUE_INDEX,
  UserOrmEntity,
} from '../entities/user.orm-entity.js';
import { UserMapper } from '../mappers/user.mapper.js';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOneBy({ id });

    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.repository.findOneBy({ email: email.value });

    return row ? UserMapper.toDomain(row) : null;
  }

  async create(user: User): Promise<void> {
    try {
      await this.repository.insert(UserMapper.toPersistence(user));
    } catch (error) {
      if (isUniqueViolation(error, USERS_EMAIL_UNIQUE_INDEX)) {
        throw new EmailAlreadyInUseError();
      }

      throw error;
    }
  }

  async update(user: User): Promise<void> {
    const { id, ...changes } = UserMapper.toPersistence(user);

    await this.repository.update({ id }, changes);
  }
}
