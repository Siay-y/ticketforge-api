export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;

  /** Hash malformado devolve `false`, nunca lança. */
  abstract verify(plain: string, hash: string): Promise<boolean>;

  abstract needsRehash(hash: string): boolean;
}
