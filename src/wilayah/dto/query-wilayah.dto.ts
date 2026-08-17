import { IsOptional, IsString, IsInt, Min, Max, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryWilayahDto {
  @ApiPropertyOptional({ description: 'Kata kunci pencarian nama wilayah', example: 'Dago' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Limit jumlah hasil untuk autocomplete', default: 100, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;
}

export class QueryKabupatenDto extends QueryWilayahDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Provinsi', example: '32' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  provinsiId?: string;
}

export class QueryKecamatanDto extends QueryWilayahDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Kabupaten', example: '32.73' })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  kabupatenId?: string;
}

export class QueryKelurahanDto extends QueryWilayahDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Kecamatan', example: '32.73.08' })
  @IsOptional()
  @IsString()
  @Length(8, 8)
  kecamatanId?: string;
}
