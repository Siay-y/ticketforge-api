const MAX_BASE_LENGTH = 80;
const SUFFIX_LENGTH = 8;

export class Slug {
  private constructor(readonly value: string) {}

  /**
   * Deriva do título e acrescenta um sufixo único: dois eventos homônimos nunca
   * colidem e o slug não muda se o título for editado depois.
   */
  static fromTitle(title: string, uniqueSuffix: string): Slug {
    const base = title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, MAX_BASE_LENGTH)
      .replace(/^-+|-+$/g, '');
    const suffix = uniqueSuffix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, SUFFIX_LENGTH);

    return new Slug(base ? `${base}-${suffix}` : suffix);
  }

  static restore(value: string): Slug {
    return new Slug(value);
  }

  toString(): string {
    return this.value;
  }
}
