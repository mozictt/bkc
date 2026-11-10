import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JenisPenjamin, StatusAktifMaster } from '../../constants/simrs.enum';

export class QueryPasienDto {
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
      'Cari berdasarkan No. RM, nama lengkap, NIK, no. identitas lain, atau nomor kartu penjamin',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter pasien yang terdaftar pada Master Penjamin tertentu',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  penjaminId?: number;

  @ApiPropertyOptional({
    enum: JenisPenjamin,
    description: 'Filter pasien yang memiliki jenis penjamin tertentu',
  })
  @IsOptional()
  @IsEnum(JenisPenjamin)
  jenisPenjamin?: JenisPenjamin;

  @ApiPropertyOptional({
    example: 3,
    description: 'Filter pasien berdasarkan ID Kelas hak penjamin',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kelasHakId?: number;

  @ApiPropertyOptional({
    description: 'Filter pasien bayi baru lahir (true/false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as boolean;
  })
  @IsBoolean()
  isBayiBaruLahir?: boolean;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif pasien (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'noRm', 'createdAt'],
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
