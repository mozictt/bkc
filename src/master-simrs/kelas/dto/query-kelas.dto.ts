import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StatusAktifMaster } from '../../constants/simrs.enum';

export class QueryKelasDto {
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
    description: 'Cari berdasarkan kode, nama kelas, atau kode BPJS Aplicare',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    description: 'Filter status aktif kelas (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'urutan',
    enum: ['id', 'kode', 'nama', 'urutan', 'createdAt'],
    description: 'Kolom pengurutan',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'urutan';

  @ApiPropertyOptional({
    default: 'ASC',
    enum: ['ASC', 'DESC'],
    description: 'Arah pengurutan',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'ASC';
}

