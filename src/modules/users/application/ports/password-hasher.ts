export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;

  /** Devolve `false` também para hash malformado, nunca lança por causa dele. */
  abstract verify(plain: string, hash: string): Promise<boolean>;

  /** Indica hash gerado com parâmetros mais fracos que os atuais. */
  abstract needsRehash(hash: string): boolean;
}
