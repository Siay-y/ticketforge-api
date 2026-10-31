/** Transação atômica: repositórios de qualquer módulo chamados em `run` participam dela. */
export abstract class UnitOfWork {
  /** Aninhado reaproveita a transação externa. */
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
