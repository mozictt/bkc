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
import {
  StatusAktifMaster,
  StatusKetersediaanBed,
} from '../../constants/simrs.enum';

export class QueryBedDto {
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
      'Cari berdasarkan kode bed, nama bed, nama kamar, unit, atau kelas',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Kelas',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kelasId?: number;

  @ApiPropertyOptional({
    enum: StatusKetersediaanBed,
    description: 'Filter berdasarkan status ketersediaan tempat tidur',
  })
  @IsOptional()
  @IsEnum(StatusKetersediaanBed)
  statusKetersediaan?: StatusKetersediaanBed;

  @ApiPropertyOptional({
    description: 'Filter bed isolasi (true/false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as boolean;
  })
  @IsBoolean()
  isIsolasi?: boolean;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif master bed (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'id',
    enum: [
      'id',
      'kode',
      'nama',
      'namaKamar',
      'statusKetersediaan',
      'createdAt',
    ],
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
