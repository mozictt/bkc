import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StatusAktifPegawai,
  StatusKepegawaian,
} from '../../master-simrs/constants/simrs.enum';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePegawaiDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Penduduk yang berelasi (opsional untuk pegawai baru terintegrasi)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Penduduk harus berupa angka bulat' })
  @Min(1, { message: 'ID Penduduk tidak valid' })
  pendudukId?: number;

  @ApiProperty({ example: 'PEG-001', description: 'Nomor Induk Pegawai (NIP)' })
  @Transform(trimString)
  @IsNotEmpty({ message: 'NIP wajib diisi' })
  @IsString({ message: 'NIP harus berupa text' })
  @MaxLength(50, { message: 'NIP maksimal 50 karakter' })
  nip: string;

  @ApiProperty({ example: 'Budi Santoso', description: 'Nama Lengkap Pegawai' })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString({ message: 'Nama lengkap harus berupa text' })
  @MaxLength(150, { message: 'Nama lengkap maksimal 150 karakter' })
  name: string;

  @ApiPropertyOptional({
    example: 'budi@example.com',
    description: 'Alamat Email Pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email?: string;

  @ApiPropertyOptional({
    example: '081234567890',
    description: 'Nomor Handphone Pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, {
    message: 'Nomor telepon hanya boleh berisi angka, spasi, tanda + atau -',
  })
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Dokter Spesialis Penyakit Dalam',
    description: 'Jabatan Pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  position?: string;

  @ApiPropertyOptional({
    enum: StatusKepegawaian,
    example: StatusKepegawaian.TETAP_RS,
    description: 'Status kepegawaian di rumah sakit',
  })
  @IsOptional()
  @IsEnum(StatusKepegawaian, { message: 'Status kepegawaian tidak valid' })
  statusKepegawaian?: StatusKepegawaian;

  @ApiPropertyOptional({
    enum: StatusAktifPegawai,
    default: StatusAktifPegawai.AKTIF,
    example: StatusAktifPegawai.AKTIF,
    description: 'Status keaktifan pegawai',
  })
  @IsOptional()
  @IsEnum(StatusAktifPegawai, { message: 'Status aktif pegawai tidak valid' })
  statusAktif?: StatusAktifPegawai;

  @ApiPropertyOptional({
    example: 'Instalasi Rawat Jalan',
    description: 'Unit kerja / instalasi penempatan pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100, { message: 'Unit kerja maksimal 100 karakter' })
  unitKerja?: string;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'Tanggal mulai bekerja (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal masuk tidak valid (YYYY-MM-DD)' },
  )
  tanggalMasuk?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Tanggal berhenti / selesai kontrak (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal keluar tidak valid (YYYY-MM-DD)' },
  )
  tanggalKeluar?: string;

  @ApiPropertyOptional({
    example: 'Saya adalah staff IT',
    description: 'Bio singkat pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500, { message: 'Bio maksimal 500 karakter' })
  bio?: string;

  @ApiPropertyOptional({
    example: 'Jl. Merdeka No. 45, Jakarta Pusat',
    description: 'Alamat domisili pegawai',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500, { message: 'Alamat maksimal 500 karakter' })
  address?: string;

  @ApiPropertyOptional({
    example: '31.71.01.1001',
    description: 'ID Kelurahan tempat tinggal pegawai (BPS/Kemendagri)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(13, { message: 'ID Kelurahan maksimal 13 karakter' })
  idKelurahan?: string;
}
