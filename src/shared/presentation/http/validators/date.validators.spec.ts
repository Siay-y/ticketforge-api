import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsDate, IsOptional, validateSync } from 'class-validator';
import { IsAfterProperty, IsFutureDate } from './date.validators.js';

class PeriodDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsAfterProperty('start')
  end?: Date;
}

class InclusivePeriodDto {
  @Type(() => Date)
  @IsDate()
  from: Date;

  @Type(() => Date)
  @IsDate()
  @IsAfterProperty('from', { allowEqual: true })
  to: Date;
}

class FutureDto {
  @Type(() => Date)
  @IsDate()
  @IsFutureDate()
  at: Date;
}

const errorsOf = <T extends object>(type: new () => T, plain: object) =>
  validateSync(plainToInstance(type, plain)).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );

describe('IsAfterProperty', () => {
  it('aceita fim posterior ao início', () => {
    expect(
      errorsOf(PeriodDto, {
        start: '2027-01-01T10:00:00Z',
        end: '2027-01-01T11:00:00Z',
      }),
    ).toEqual([]);
  });

  it.each([
    ['anterior', '2027-01-01T09:00:00Z'],
    ['igual', '2027-01-01T10:00:00Z'],
  ])('recusa fim %s ao início', (_, end) => {
    expect(errorsOf(PeriodDto, { start: '2027-01-01T10:00:00Z', end })).toEqual(
      ['isAfterProperty'],
    );
  });

  it('não valida quando a outra data falta (PATCH parcial)', () => {
    expect(errorsOf(PeriodDto, { end: '2027-01-01T11:00:00Z' })).toEqual([]);
  });

  it('com allowEqual, aceita datas iguais', () => {
    const at = '2027-01-01T10:00:00Z';

    expect(errorsOf(InclusivePeriodDto, { from: at, to: at })).toEqual([]);
  });
});

describe('IsFutureDate', () => {
  it('aceita data futura e recusa passada', () => {
    expect(errorsOf(FutureDto, { at: '2999-01-01T00:00:00Z' })).toEqual([]);
    expect(errorsOf(FutureDto, { at: '2000-01-01T00:00:00Z' })).toEqual([
      'isFutureDate',
    ]);
  });
});
