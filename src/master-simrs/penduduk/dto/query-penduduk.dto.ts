import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JenisKelamin } from '../../constants/simrs.enum';

export class QueryPendudukDto {
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
    description: 'Cari berdasarkan NIK atau Nama Lengkap',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: JenisKelamin,
    description: 'Filter berdasarkan jenis kelamin (L/P)',
  })
  @IsOptional()
  @IsEnum(JenisKelamin)
  jenisKelamin?: JenisKelamin;

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Kelurahan' })
  @IsOptional()
  @IsString()
  idKelurahan?: string;

  @ApiPropertyOptional({
    default: 'id',
    enum: ['id', 'namaLengkap', 'nik', 'createdAt'],
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
