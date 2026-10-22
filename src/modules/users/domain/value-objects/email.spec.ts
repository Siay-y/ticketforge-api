import { InvalidEmailError } from '../errors/invalid-email.error.js';
import { Email } from './email.js';

describe('Email', () => {
  it('normaliza espaços e caixa', () => {
    expect(Email.create('  Cliente@TicketForge.DEV ').value).toBe(
      'cliente@ticketforge.dev',
    );
  });

  it('considera iguais endereços que só diferem na caixa', () => {
    expect(Email.create('a@x.dev').equals(Email.create('A@X.dev'))).toBe(true);
  });

  it.each(['', 'sem-arroba', 'a@b', 'a@@b.dev', 'a b@x.dev', 'a@x..dev'])(
    'rejeita "%s"',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );

  it('rejeita endereço com mais de 254 caracteres', () => {
    const raw = `${'a'.repeat(250)}@x.dev`;

    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });
});
