import { SetMetadata } from '@nestjs/common';

// Pastikan menggunakan 'export const'
export const ResponseMessage = (message: string) =>
  SetMetadata('message', message);
