import type { PasswordHasher } from '../application/ports/password-hasher.js';

/** Hasher reversível e instantâneo, só para testes de caso de uso. */
export class FakePasswordHasher implements PasswordHasher {
  readonly verifiedAgainst: string[] = [];
  outdatedHashes = new Set<string>();

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    this.verifiedAgainst.push(hash);

    return Promise.resolve(hash === `hashed:${plain}`);
  }

  needsRehash(hash: string): boolean {
    return this.outdatedHashes.has(hash);
  }
}
