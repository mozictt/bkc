import { SetMetadata } from '@nestjs/common';

export const CheckPermission = (action: string, menu: string) =>
  SetMetadata('permission', { action, menu });
