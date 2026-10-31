import { InvalidEmailError } from '../errors/invalid-email.error.js';

// Simples de propósito: a posse do endereço só se prova por confirmação.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_LENGTH = 254;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }

    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
