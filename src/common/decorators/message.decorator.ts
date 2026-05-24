import { SetMetadata } from '@nestjs/common';

// Ini decorator yang akan kamu panggil dengan @Message('Pesan Kustom')
export const Message = (message: string) => SetMetadata('message', message);