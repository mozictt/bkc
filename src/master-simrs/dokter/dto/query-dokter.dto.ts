import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JenisDokter, StatusAktifMaster } from '../../constants/simrs.enum';

export class QueryDokterDto {
  @ApiPropertyOptional({ default: 1, description: 'Nomor halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Jumlah item per halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Cari berdasarkan kode dokter, nama, NIP, nomor STR, nomor SIP, atau spesialisasi',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: JenisDokter,
    description: 'Filter berdasarkan jenis dokter',
  })
  @IsOptional()
  @IsEnum(JenisDokter)
  jenisDokter?: JenisDokter;

  @ApiPropertyOptional({ description: 'Filter berdasarkan spesialisasi' })
  @IsOptional()
  @IsString()
  spesialisasi?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif dokter (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'kodeDokter', 'jenisDokter', 'spesialisasi', 'createdAt'],
    description: 'Kolom pengurutan',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'id';

  @ApiPropertyOptional({
    default: 'DESC',
    enum: ['ASC', 'DESC'],
    description: 'Arah pengurutan',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'DESC';
}
