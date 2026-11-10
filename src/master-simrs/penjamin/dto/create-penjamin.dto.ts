import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { JenisPenjamin, StatusAktifMaster } from '../../constants/simrs.enum';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreatePenjaminDto {
  @ApiProperty({
    example: 'BPJS',
    description: 'Kode unik master penjamin per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode penjamin wajib diisi' })
  @IsString({ message: 'Kode penjamin harus berupa teks' })
  @MaxLength(30, { message: 'Kode penjamin maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'BPJS Kesehatan',
    description: 'Nama resmi penjamin / asuransi / perusahaan',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama penjamin wajib diisi' })
  @IsString({ message: 'Nama penjamin harus berupa teks' })
  @MaxLength(120, { message: 'Nama penjamin maksimal 120 karakter' })
  nama: string;

  @ApiProperty({
    enum: JenisPenjamin,
    example: JenisPenjamin.BPJS,
    description: 'Kategori penjamin',
  })
  @IsNotEmpty({ message: 'Jenis penjamin wajib diisi' })
  @IsEnum(JenisPenjamin, { message: 'Jenis penjamin tidak valid' })
  jenisPenjamin: JenisPenjamin;

  @ApiPropertyOptional({
    example: 'PT Asuransi Jiwa Bersama',
    description: 'Nama perusahaan induk / grup asuransi (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(150, { message: 'Perusahaan induk maksimal 150 karakter' })
  perusahaanInduk?: string;

  @ApiPropertyOptional({
    example: '021500400',
    description: 'Nomor telepon kantor / layanan penjamin',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, {
    message: 'Nomor telepon hanya boleh berisi angka, spasi, tanda + atau -',
  })
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  noTelepon?: string;

  @ApiPropertyOptional({
    example: 'klaim@asuransi.co.id',
    description: 'Email resmi penjamin untuk klaim/koordinasi',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email?: string;

  @ApiPropertyOptional({
    example: 'Jl. Letjen MT Haryono Kav. 4-5, Jakarta',
    description: 'Alamat kantor penjamin',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Alamat maksimal 500 karakter' })
  alamat?: string;

  @ApiPropertyOptional({
    example: 'Rina Kusuma',
    description: 'Nama PIC / contact person kerja sama penjamin',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120, { message: 'Nama PIC maksimal 120 karakter' })
  picNama?: string;

  @ApiPropertyOptional({
    example: '081234567891',
    description: 'Nomor telepon PIC penjamin',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, {
    message:
      'Nomor telepon PIC hanya boleh berisi angka, spasi, tanda + atau -',
  })
  @MaxLength(20, { message: 'Nomor telepon PIC maksimal 20 karakter' })
  picTelepon?: string;

  @ApiPropertyOptional({
    example: 'PKS/RS-01/2026',
    description: 'Nomor Perjanjian Kerja Sama (PKS)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80, { message: 'Nomor PKS maksimal 80 karakter' })
  noPks?: string;

  @ApiPropertyOptional({
    example: '2028-12-31',
    description: 'Tanggal berakhir Perjanjian Kerja Sama (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString(
    {},
    { message: 'Format tanggal berlaku PKS tidak valid (YYYY-MM-DD)' },
  )
  pksBerlakuSampai?: string;

  @ApiPropertyOptional({
    example: '0001',
    description: 'Kode eksternal penjamin (untuk bridging BPJS / SATUSEHAT)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30, { message: 'Kode eksternal maksimal 30 karakter' })
  kodeEksternalBpjs?: string;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description:
      'Menandakan apakah pasien wajib mengisi nomor kartu/polis saat memilih penjamin ini (false untuk Umum/Pribadi)',
  })
  @IsOptional()
  @IsBoolean({ message: 'butuhNoKartu harus berupa boolean' })
  butuhNoKartu?: boolean;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif penjamin (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}
