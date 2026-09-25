import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ description: 'Konten teks pesan yang diperbarui', example: 'Pesan yang sudah diedit' })
  @IsString()
  @MinLength(1)
  content: string;
}
