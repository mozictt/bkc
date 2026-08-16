import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class BulkActionDto {
  @ApiProperty({
    type: [String],
    description: 'Array ID media galeri (UUID v4)',
    example: ['d44235c7-a205-44ea-b026-b857c28c8695'],
  })
  @IsArray({ message: 'ids harus berupa array' })
  @ArrayNotEmpty({ message: 'ids tidak boleh kosong' })
  @IsUUID('4', { each: true, message: 'Setiap id harus berupa UUID v4 yang valid' })
  ids: string[];
}
