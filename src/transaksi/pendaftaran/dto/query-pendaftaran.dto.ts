import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  JenisPenjamin,
  SesiPraktik,
} from '@src/master-simrs/constants/simrs.enum';
import { trimOptionalString } from '@src/master-simrs/helpers/master-entity.helper';
import {
  JenisLayananPendaftaran,
  StatusKunjungan,
} from '../constants/pendaftaran.enum';

export class QueryPendaftaranDto {
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
      'Cari berdasarkan No. Registrasi, No. RM, Nama Pasien, NIK, No. Kartu Penjamin, atau No. SEP',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Filter tanggal kunjungan mulai (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggalDari harus YYYY-MM-DD',
  })
  tanggalDari?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Filter tanggal kunjungan sampai (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggalSampai harus YYYY-MM-DD',
  })
  tanggalSampai?: string;

  @ApiPropertyOptional({
    enum: JenisLayananPendaftaran,
    description:
      'Filter jenis layanan saat ini (RAWAT_JALAN / RAWAT_INAP / IGD / INTENSIVE)',
  })
  @IsOptional()
  @IsEnum(JenisLayananPendaftaran)
  jenisLayanan?: JenisLayananPendaftaran;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit pelayanan saat ini',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Dokter saat ini',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dokterId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Master Penjamin',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  penjaminId?: number;

  @ApiPropertyOptional({
    enum: JenisPenjamin,
    description:
      'Filter berdasarkan jenis penjamin (UMUM / BPJS / ASURANSI_SWASTA / dll.)',
  })
  @IsOptional()
  @IsEnum(JenisPenjamin)
  jenisPenjamin?: JenisPenjamin;

  @ApiPropertyOptional({
    enum: StatusKunjungan,
    description: 'Filter status kunjungan',
  })
  @IsOptional()
  @IsEnum(StatusKunjungan)
  statusKunjungan?: StatusKunjungan;

  @ApiPropertyOptional({
    description:
      'Jika true, hanya tampilkan kunjungan aktif (TERDAFTAR, DALAM_PELAYANAN, DIRAWAT)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as boolean;
  })
  @IsBoolean()
  aktifSaja?: boolean;

  @ApiPropertyOptional({
    default: 'id',
    enum: [
      'id',
      'noRegistrasi',
      'tanggalKunjungan',
      'waktuDaftar',
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

export class QueryJadwalTersediaDto {
  @ApiPropertyOptional({
    example: '2026-11-11',
    description:
      'Tanggal kunjungan (YYYY-MM-DD) untuk pemetaan hari praktik dan sisa kuota aktual. Default hari ini.',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggal harus YYYY-MM-DD',
  })
  tanggal?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Unit / Poliklinik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filter berdasarkan ID Dokter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dokterId?: number;

  @ApiPropertyOptional({
    enum: SesiPraktik,
    description:
      'Filter berdasarkan sesi praktik (PAGI / SIANG / SORE / MALAM)',
  })
  @IsOptional()
  @IsEnum(SesiPraktik)
  sesi?: SesiPraktik;

  @ApiPropertyOptional({
    enum: JenisPenjamin,
    description:
      'Jenis penjamin pasien untuk membantu menyorot ketersediaan kuota JKN vs Non-JKN',
  })
  @IsOptional()
  @IsEnum(JenisPenjamin)
  jenisPenjamin?: JenisPenjamin;

  @ApiPropertyOptional({
    description:
      'Cari berdasarkan nama/kode dokter, spesialisasi, atau nama unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;
}
