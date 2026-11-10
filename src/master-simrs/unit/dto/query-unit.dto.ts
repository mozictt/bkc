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
import { JenisUnit, StatusAktifMaster } from '../../constants/simrs.enum';

export class QueryUnitDto {
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
      'Cari berdasarkan kode, nama unit, gedung, atau kode BPJS poli',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: JenisUnit,
    description: 'Filter berdasarkan jenis unit',
  })
  @IsOptional()
  @IsEnum(JenisUnit)
  jenisUnit?: JenisUnit;

  @ApiPropertyOptional({
    description: 'Filter unit yang mendukung tempat tidur (true/false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as boolean;
  })
  @IsBoolean()
  isTersediaBed?: boolean;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif unit (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'kode', 'nama', 'jenisUnit', 'createdAt'],
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
