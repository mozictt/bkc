import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiPropertyOptional({
    description: 'Deskripsi singkat mengenai dokumen yang diunggah',
    example: 'Dokumen laporan keuangan Q3 2026',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File berkas (PDF, Word, Excel, ZIP, TAR, TGZ, dll.)',
  })
  file: any;
}
