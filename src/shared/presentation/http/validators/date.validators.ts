import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export interface IsAfterPropertyOptions extends ValidationOptions {
  /** Aceita datas iguais. Padrão: `false`. */
  allowEqual?: boolean;
}

/**
 * Exige que a data seja posterior à de outra propriedade do mesmo DTO.
 * Se alguma das duas faltar, não valida: em PATCH parcial, a regra fica com o domínio.
 */
export function IsAfterProperty(
  property: string,
  { allowEqual = false, ...options }: IsAfterPropertyOptions = {},
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isAfterProperty',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [property],
      options: {
        message: `${String(propertyName)} deve ser ${allowEqual ? 'igual ou ' : ''}posterior a ${property}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = (args.object as Record<string, unknown>)[property];

          if (!(value instanceof Date) || !(other instanceof Date)) {
            return true;
          }

          return allowEqual ? value >= other : value > other;
        },
      },
    });
  };
}

/** Exige data no futuro. Valores que não são `Date` ficam a cargo de `@IsDate()`. */
export function IsFutureDate(
  options: ValidationOptions = {},
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isFutureDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: `${String(propertyName)} deve ser uma data futura`,
        ...options,
      },
      validator: {
        validate: (value: unknown): boolean =>
          !(value instanceof Date) || value.getTime() > Date.now(),
      },
    });
  };
}
