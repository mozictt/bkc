import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  HariPraktik,
  SesiPraktik,
  StatusAktifMaster,
} from '../../constants/simrs.enum';
import { trimOptionalString } from '../../helpers/master-entity.helper';

export class QueryJadwalDokterDto {
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
      'Cari berdasarkan kode/nama dokter, spesialisasi, kode/nama unit, ruangan, atau kode jadwal BPJS',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Dokter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dokterId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit / Poliklinik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    enum: HariPraktik,
    description: 'Filter berdasarkan hari praktik',
  })
  @IsOptional()
  @IsEnum(HariPraktik)
  hari?: HariPraktik;

  @ApiPropertyOptional({
    enum: SesiPraktik,
    description: 'Filter berdasarkan sesi praktik',
  })
  @IsOptional()
  @IsEnum(SesiPraktik)
  sesi?: SesiPraktik;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif jadwal dokter (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'hari', 'jamMulai', 'jamSelesai', 'kuotaTotal', 'createdAt'],
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

export class QueryOptionsJadwalDokterDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit / Poliklinik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Dokter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dokterId?: number;

  @ApiPropertyOptional({
    enum: HariPraktik,
    description: 'Filter berdasarkan hari praktik',
  })
  @IsOptional()
  @IsEnum(HariPraktik)
  hari?: HariPraktik;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description:
      'Filter berdasarkan tanggal kunjungan (YYYY-MM-DD); otomatis dipetakan ke hari praktik',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggal harus YYYY-MM-DD',
  })
  tanggal?: string;

  @ApiPropertyOptional({
    enum: SesiPraktik,
    description: 'Filter berdasarkan sesi praktik',
  })
  @IsOptional()
  @IsEnum(SesiPraktik)
  sesi?: SesiPraktik;

  @ApiPropertyOptional({
    description: 'Cari berdasarkan nama/kode dokter, spesialisasi, atau unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;
}

export class QueryMingguanJadwalDokterDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit / Poliklinik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Dokter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dokterId?: number;

  @ApiPropertyOptional({
    enum: SesiPraktik,
    description: 'Filter berdasarkan sesi praktik',
  })
  @IsOptional()
  @IsEnum(SesiPraktik)
  sesi?: SesiPraktik;

  @ApiPropertyOptional({
    description: 'Cari berdasarkan nama/kode dokter, spesialisasi, atau unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;
}

