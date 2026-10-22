import { Slug } from './slug.js';

const SUFFIX = '3f9a1c2b-0000-4000-8000-000000000000';

describe('Slug', () => {
  it('remove acentos, pontuação e espaços e acrescenta o sufixo', () => {
    expect(
      Slug.fromTitle('  Festival de Verão: 2ª Edição!  ', SUFFIX).value,
    ).toBe('festival-de-verao-2-edicao-3f9a1c2b');
  });

  it('dois títulos iguais geram slugs diferentes', () => {
    const first = Slug.fromTitle('Rock in Rio', crypto.randomUUID());
    const second = Slug.fromTitle('Rock in Rio', crypto.randomUUID());

    expect(first.value).not.toBe(second.value);
  });

  it('limita o tamanho sem terminar em hífen', () => {
    const slug = Slug.fromTitle(`${'a'.repeat(79)} b`, SUFFIX).value;

    expect(slug).toBe(`${'a'.repeat(79)}-3f9a1c2b`);
    expect(slug.length).toBeLessThanOrEqual(100);
  });

  it('título só com símbolos vira apenas o sufixo', () => {
    expect(Slug.fromTitle('!!!', SUFFIX).value).toBe('3f9a1c2b');
  });
});
