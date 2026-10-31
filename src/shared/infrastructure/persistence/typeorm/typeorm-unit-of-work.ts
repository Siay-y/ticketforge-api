import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type { UnitOfWork } from '../../../application/unit-of-work.js';

// Propaga o manager da transação pelas chamadas assíncronas, entre módulos.
const transactionStorage = new AsyncLocalStorage<EntityManager>();

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (transactionStorage.getStore()) {
      return work();
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      const result = await transactionStorage.run(runner.manager, work);

      await runner.commitTransaction();

      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

@Injectable()
export class TransactionContext {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  get manager(): EntityManager {
    return transactionStorage.getStore() ?? this.dataSource.manager;
  }

  /** Exige transação: lock em autocommit é solto na hora. */
  get transactionalManager(): EntityManager {
    const manager = transactionStorage.getStore();

    if (!manager) {
      throw new Error('Operação exige uma transação ativa (UnitOfWork.run)');
    }

    return manager;
  }
}
