import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:is-public';

/** Dispensa o access token. Sem este decorator, toda rota exige autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
