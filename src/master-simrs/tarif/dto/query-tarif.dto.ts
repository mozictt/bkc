import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JenisTarif, StatusAktifMaster } from '../../constants/simrs.enum';

export class QueryTarifDto {
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
    description: 'Cari kode, nama tindakan, kelompok tarif, atau kode eksternal',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: JenisTarif,
    description: 'Filter berdasarkan kategori tarif (BIASA, LABORATORIUM, RADIOLOGI)',
  })
  @IsOptional()
  @IsEnum(JenisTarif)
  jenisTarif?: JenisTarif;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter tindakan yang memiliki aturan tarif untuk ID Unit tertentu',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter tindakan yang memiliki aturan tarif untuk ID Penjamin tertentu',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  penjaminId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter tindakan yang memiliki aturan tarif untuk ID Kelas tertentu',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kelasId?: number;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif tindakan (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'kode', 'nama', 'jenisTarif', 'createdAt'],
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

export class ResolveTarifDto {
  @ApiProperty({ example: 1, description: 'ID Master Tindakan yang dicari tarifnya' })
  @IsNotEmpty({ message: 'ID Tindakan wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Tindakan harus berupa angka bulat' })
  @Min(1)
  tindakanId: number;

  @ApiPropertyOptional({ example: 2, description: 'ID Unit pelayanan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID Penjamin pasien' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  penjaminId?: number;

  @ApiPropertyOptional({ example: 3, description: 'ID Kelas perawatan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kelasId?: number;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description: 'Tanggal referensi layanan (YYYY-MM-DD), default hari ini',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal tidak valid (YYYY-MM-DD)' })
  tanggal?: string;
}
