import {
  DEFAULT_SCRYPT_PARAMS,
  ScryptPasswordHasher,
} from './scrypt-password-hasher.js';

const PASSWORD = 'Ingresso#2026Seguro';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('gera hash no formato PHC com os parâmetros atuais', async () => {
    const hash = await hasher.hash(PASSWORD);

    expect(hash).toMatch(
      /^\$scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{86}$/,
    );
  });

  it('aceita a senha correta e recusa qualquer outra', async () => {
    const hash = await hasher.hash(PASSWORD);

    await expect(hasher.verify(PASSWORD, hash)).resolves.toBe(true);
    await expect(hasher.verify('Ingresso#2026Segur0', hash)).resolves.toBe(
      false,
    );
  });

  it('usa salt aleatório: a mesma senha gera hashes diferentes', async () => {
    const [first, second] = await Promise.all([
      hasher.hash(PASSWORD),
      hasher.hash(PASSWORD),
    ]);

    expect(first).not.toBe(second);
  });

  it('trata formas Unicode equivalentes como a mesma senha', async () => {
    const composed = 'Senha#Ção2026';
    const decomposed = composed.normalize('NFD');
    const hash = await hasher.hash(composed);

    await expect(hasher.verify(decomposed, hash)).resolves.toBe(true);
  });

  it.each([
    'texto-qualquer',
    '$scrypt$ln=15,r=8,p=3$semhash',
    '$bcrypt$ln=15,r=8,p=3$c2FsdA$aGFzaA',
    '$scrypt$ln=40,r=8,p=3$c2FsdA$aGFzaA',
  ])('recusa hash malformado ou abusivo sem lançar: %s', async (hash) => {
    await expect(hasher.verify(PASSWORD, hash)).resolves.toBe(false);
  });

  it('sinaliza rehash para parâmetros mais fracos que os atuais', async () => {
    const weak = new ScryptPasswordHasher({
      ...DEFAULT_SCRYPT_PARAMS,
      logCost: 10,
    });
    const weakHash = await weak.hash(PASSWORD);

    expect(hasher.needsRehash(weakHash)).toBe(true);
    expect(hasher.needsRehash(await hasher.hash(PASSWORD))).toBe(false);
    await expect(hasher.verify(PASSWORD, weakHash)).resolves.toBe(true);
  });
});
