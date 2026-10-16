import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadChunkDto {
  @ApiProperty({
    description: 'ID unik sesi unggah berkas (UUID / string unik)',
    example: '1729080000000-a1b2c3d4-e5f6',
  })
  @IsNotEmpty()
  @IsString()
  uploadId: string;

  @ApiProperty({
    description: 'Indeks potongan berkas saat ini (dimulai dari 0)',
    example: 0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  chunkIndex: number;

  @ApiProperty({
    description: 'Total jumlah potongan berkas',
    example: 10,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  totalChunks: number;

  @ApiProperty({
    description: 'Nama asli berkas yang diunggah',
    example: 'video-dokumentasi.mp4',
  })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'Ukuran total berkas asli dalam bytes',
    required: false,
    example: 104857600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalSize?: number;

  @ApiProperty({
    description: 'ID Album opsional (UUID). Jika diisi, media disimpan di album tersebut',
    required: false,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  albumId?: string;
}
