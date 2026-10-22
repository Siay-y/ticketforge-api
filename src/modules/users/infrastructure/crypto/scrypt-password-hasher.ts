import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from '../../application/ports/password-hasher.js';

export interface ScryptParams {
  /** log2 do custo N. */
  logCost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
  saltLength: number;
}

// Perfil da OWASP (N=2^15, r=8, p=3): mesma resistência de N=2^17 com 1/4 da
// memória por hash (32 MiB), o que importa em picos de login simultâneo.
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  logCost: 15,
  blockSize: 8,
  parallelization: 3,
  keyLength: 64,
  saltLength: 16,
};

// Teto para parâmetros lidos do banco: um hash adulterado não pode esgotar CPU ou memória.
const MAX_LOG_COST = 20;
const MAX_FACTOR = 16;

// Formato PHC: $scrypt$ln=15,r=8,p=3$<salt>$<hash>, em base64 sem padding.
const HASH_PATTERN =
  /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface ParsedHash {
  logCost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  key: Buffer;
}

export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly params: ScryptParams = DEFAULT_SCRYPT_PARAMS) {}

  async hash(plain: string): Promise<string> {
    const { logCost, blockSize, parallelization, keyLength, saltLength } =
      this.params;
    const salt = randomBytes(saltLength);
    const key = await derive(plain, salt, keyLength, {
      logCost,
      blockSize,
      parallelization,
    });

    return [
      '',
      'scrypt',
      `ln=${logCost},r=${blockSize},p=${parallelization}`,
      encode(salt),
      encode(key),
    ].join('$');
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    const parsed = parse(hash);

    if (!parsed) {
      return false;
    }

    const candidate = await derive(
      plain,
      parsed.salt,
      parsed.key.length,
      parsed,
    );

    return timingSafeEqual(candidate, parsed.key);
  }

  needsRehash(hash: string): boolean {
    const parsed = parse(hash);

    return (
      !parsed ||
      parsed.logCost < this.params.logCost ||
      parsed.blockSize < this.params.blockSize ||
      parsed.parallelization < this.params.parallelization ||
      parsed.key.length < this.params.keyLength ||
      parsed.salt.length < this.params.saltLength
    );
  }
}

function derive(
  plain: string,
  salt: Buffer,
  keyLength: number,
  cost: Pick<ScryptParams, 'logCost' | 'blockSize' | 'parallelization'>,
): Promise<Buffer> {
  const N = 2 ** cost.logCost;
  const options = {
    N,
    r: cost.blockSize,
    p: cost.parallelization,
    // O padrão do Node (32 MiB) fica no limite exato de N=2^15, r=8.
    maxmem: 256 * N * cost.blockSize,
  };

  return new Promise((resolve, reject) => {
    scrypt(plain.normalize('NFKC'), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

function parse(hash: string): ParsedHash | null {
  const match = HASH_PATTERN.exec(hash);

  if (!match) {
    return null;
  }

  const [, logCost, blockSize, parallelization, salt, key] = match;
  const parsed: ParsedHash = {
    logCost: Number(logCost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  };

  const withinLimits =
    parsed.logCost >= 1 &&
    parsed.logCost <= MAX_LOG_COST &&
    parsed.blockSize >= 1 &&
    parsed.blockSize <= MAX_FACTOR &&
    parsed.parallelization >= 1 &&
    parsed.parallelization <= MAX_FACTOR &&
    parsed.key.length > 0;

  return withinLimits ? parsed : null;
}

const encode = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/=+$/, '');
