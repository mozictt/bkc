import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreatePendaftaranPenjaminItemDto } from './create-pendaftaran.dto';

export class UpdatePenjaminPendaftaranDto {
  @ApiProperty({
    type: () => [CreatePendaftaranPenjaminItemDto],
    description:
      'Daftar penjamin kunjungan terbaru (minimal 1 penjamin; menggantikan konfigurasi penjamin kunjungan saat ini)',
  })
  @IsArray({ message: 'penjaminList harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 penjamin pada kunjungan' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 penjamin dalam satu kunjungan' })
  @ValidateNested({ each: true })
  @Type(() => CreatePendaftaranPenjaminItemDto)
  penjaminList: CreatePendaftaranPenjaminItemDto[];
}
