import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Rutas accesibles sin JWT (login, registro si está habilitado, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
