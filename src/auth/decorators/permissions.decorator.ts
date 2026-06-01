import { SetMetadata } from '@nestjs/common';

// Mengizinkan action berupa string tunggal atau array dari string
export const CheckPermission = (action: string | string[], menu: string) =>
  SetMetadata('permission', { action, menu });