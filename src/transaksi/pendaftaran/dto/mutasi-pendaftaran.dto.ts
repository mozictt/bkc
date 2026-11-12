import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { trimOptionalString } from '@src/master-simrs/helpers/master-entity.helper';

const optionalPositiveInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return Number(value);
};

export class MutasiPendaftaranDto {
  @ApiProperty({
    example: 2,
    description:
      'ID Master Unit tujuan mutasi (Poli Rajal lain, Ruang Rawat Inap, atau Intensive)',
  })
  @IsNotEmpty({ message: 'ID Unit tujuan wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Unit tujuan harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit tujuan tidak valid' })
  unitTujuanId: number;

  @ApiPropertyOptional({
    example: 4,
    description:
      'ID Jadwal Dokter tujuan (wajib jika unit tujuan RAWAT_JALAN; tetap memotong kuota dan mendapat antrean baru)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Jadwal Dokter harus berupa angka bulat' })
  @Min(1, { message: 'ID Jadwal Dokter tidak valid' })
  jadwalDokterId?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'ID Dokter tujuan / DPJP (wajib jika jadwalDokterId tidak diisi)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Dokter tujuan harus berupa angka bulat' })
  @Min(1, { message: 'ID Dokter tujuan tidak valid' })
  dokterTujuanId?: number;

  @ApiPropertyOptional({
    example: 12,
    description:
      'ID Bed tujuan yang masih KOSONG (wajib jika unit tujuan RAWAT_INAP / INTENSIVE)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Bed tujuan harus berupa angka bulat' })
  @Min(1, { message: 'ID Bed tujuan tidak valid' })
  bedTujuanId?: number;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description:
      'Tanggal efektif mutasi (YYYY-MM-DD) untuk validasi hari & kuota jadwal poli tujuan. Default tanggal hari ini.',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggalMutasi harus YYYY-MM-DD',
  })
  tanggalMutasi?: string;

  @ApiPropertyOptional({
    example:
      'Konsul lanjutan ke Poli Penyakit Dalam / butuh observasi rawat inap',
    description: 'Alasan perpindahan atau mutasi unit pasien',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Alasan mutasi maksimal 500 karakter' })
  alasan?: string;

  @ApiPropertyOptional({
    example: 'Pasien stabil untuk dipindahkan menggunakan kursi roda',
    description: 'Catatan serah terima antar unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan mutasi maksimal 1000 karakter' })
  catatan?: string;
}
