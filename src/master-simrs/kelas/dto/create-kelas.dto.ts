import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusAktifMaster } from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';

export class CreateKelasDto {
  @ApiProperty({
    example: 'KL1',
    description: 'Kode unik kelas perawatan per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode kelas wajib diisi' })
  @IsString({ message: 'Kode kelas harus berupa teks' })
  @MaxLength(30, { message: 'Kode kelas maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'Kelas 1',
    description: 'Nama kelas perawatan / tarif akomodasi',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama kelas wajib diisi' })
  @IsString({ message: 'Nama kelas harus berupa teks' })
  @MaxLength(100, { message: 'Nama kelas maksimal 100 karakter' })
  nama: string;

  @ApiPropertyOptional({
    default: 0,
    example: 3,
    description:
      'Urutan tingkatan kelas (semakin kecil semakin tinggi atau sesuai urutan RS)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Urutan harus berupa angka bulat' })
  @Min(0, { message: 'Urutan minimal 0' })
  urutan?: number;

  @ApiPropertyOptional({
    example: 'KL1',
    description:
      'Kode kelas pada bridging BPJS Aplicare (VVP, VIP, KL1, KL2, KL3, ICU)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20, { message: 'Kode BPJS Aplicare maksimal 20 karakter' })
  kodeBpjsAplicare?: string;

  @ApiPropertyOptional({
    example: 350000,
    description: 'Tarif akomodasi kamar dasar per hari',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Tarif akomodasi harus berupa angka maksimal 2 desimal' },
  )
  @Min(0, { message: 'Tarif akomodasi tidak boleh negatif' })
  tarifAkomodasi?: number;

  @ApiPropertyOptional({
    example: 'Ruang perawatan 2 tempat tidur per kamar dengan AC & TV',
    description: 'Keterangan fasilitas kelas',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif kelas (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}
