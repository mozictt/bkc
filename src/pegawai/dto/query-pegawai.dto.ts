import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  StatusAktifPegawai,
  StatusKepegawaian,
} from '../../master-simrs/constants/simrs.enum';

export class QueryPegawaiDto {
  @ApiPropertyOptional({ default: 1, description: 'Halaman ke berapa' })
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
    description: 'Cari berdasarkan NIP atau Nama Pegawai',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan Jabatan' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    enum: StatusKepegawaian,
    description: 'Filter berdasarkan status kepegawaian',
  })
  @IsOptional()
  @IsEnum(StatusKepegawaian)
  statusKepegawaian?: StatusKepegawaian;

  @ApiPropertyOptional({
    enum: StatusAktifPegawai,
    description: 'Filter berdasarkan status aktif pegawai',
  })
  @IsOptional()
  @IsEnum(StatusAktifPegawai)
  statusAktif?: StatusAktifPegawai;

  @ApiPropertyOptional({ description: 'Filter berdasarkan Unit Kerja' })
  @IsOptional()
  @IsString()
  unitKerja?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: [
      'createdAt',
      'nip',
      'name',
      'position',
      'statusKepegawaian',
      'statusAktif',
    ],
    description: 'Kolom pengurutan',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    default: 'DESC',
    enum: ['ASC', 'DESC'],
    description: 'Tipe pengurutan',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'DESC';
}
