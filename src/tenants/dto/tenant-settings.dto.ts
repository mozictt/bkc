import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trimToNullIfEmpty = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const optionalNullableInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = Number(value);
  return num === 0 ? null : num;
};

const trimOptionalNonEmpty = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class UpdateTenantNoRmSettingDto {
  @ApiPropertyOptional({
    enum: ['PRESET', 'CUSTOM'],
    example: 'PRESET',
    description: 'Mode penomoran No. RM tenant: PRESET atau CUSTOM',
  })
  @IsOptional()
  @IsIn(['PRESET', 'CUSTOM'], {
    message: 'Mode No. RM hanya boleh PRESET atau CUSTOM',
  })
  mode?: 'PRESET' | 'CUSTOM';

  @ApiPropertyOptional({
    enum: ['PLAIN_8', 'PLAIN_4', 'DASH_6', 'CUSTOM'],
    example: 'PLAIN_4',
    description:
      'Preset model No. RM (PLAIN_8 = 8 digit, PLAIN_4 = 4 digit, DASH_6 = 6 digit strip, CUSTOM)',
  })
  @IsOptional()
  @IsIn(['PLAIN_8', 'PLAIN_4', 'DASH_6', 'CUSTOM'], {
    message:
      'Preset kode No. RM hanya boleh PLAIN_8, PLAIN_4, DASH_6, atau CUSTOM',
  })
  presetKode?: 'PLAIN_8' | 'PLAIN_4' | 'DASH_6' | 'CUSTOM';

  @ApiPropertyOptional({
    example: 4,
    minimum: 3,
    maximum: 12,
    description: 'Jumlah digit angka No. RM (3 sampai 12 digit)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Jumlah digit harus berupa angka bulat' })
  @Min(3, { message: 'Jumlah digit minimal 3 digit' })
  @Max(12, { message: 'Jumlah digit maksimal 12 digit' })
  jumlahDigit?: number;

  @ApiPropertyOptional({
    example: 'RM-',
    nullable: true,
    description: 'Prefix awalan No. RM (opsional, maksimal 6 karakter)',
  })
  @IsOptional()
  @Transform(trimToNullIfEmpty)
  @IsString({ message: 'Prefix harus berupa teks' })
  @MaxLength(6, { message: 'Prefix maksimal 6 karakter' })
  prefix?: string | null;

  @ApiPropertyOptional({
    example: '-RJ',
    nullable: true,
    description: 'Suffix akhiran No. RM (opsional, maksimal 6 karakter)',
  })
  @IsOptional()
  @Transform(trimToNullIfEmpty)
  @IsString({ message: 'Suffix harus berupa teks' })
  @MaxLength(6, { message: 'Suffix maksimal 6 karakter' })
  suffix?: string | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    minimum: 2,
    maximum: 6,
    description: 'Panjang blok pemisah digit (2 sampai 6, atau null/0 tanpa pemisah)',
  })
  @IsOptional()
  @Transform(optionalNullableInt)
  @IsInt({ message: 'Panjang blok harus berupa angka bulat' })
  @Min(2, { message: 'Panjang blok minimal 2 digit' })
  @Max(6, { message: 'Panjang blok maksimal 6 digit' })
  panjangBlok?: number | null;

  @ApiPropertyOptional({
    example: '-',
    nullable: true,
    enum: ['-', '.', '/'],
    description: 'Karakter pemisah blok (-, ., atau /)',
  })
  @IsOptional()
  @Transform(trimToNullIfEmpty)
  @IsIn(['-', '.', '/'], {
    message: 'Pemisah blok hanya boleh "-", ".", atau "/"',
  })
  pemisahBlok?: '-' | '.' | '/' | null;

  @ApiPropertyOptional({
    default: false,
    example: false,
    description:
      'Izinkan petugas memilih ulang format No. RM langsung di form pendaftaran',
  })
  @IsOptional()
  @IsBoolean({ message: 'izinkanPilihFormatDiPendaftaran harus berupa boolean' })
  izinkanPilihFormatDiPendaftaran?: boolean;
}

export class UpdateTenantPendaftaranSettingDto {
  @ApiPropertyOptional({
    example: 'Pendaftaran Kunjungan Pasien Rajal',
    description: 'Judul utama halaman pendaftaran pasien untuk tenant ini',
  })
  @IsOptional()
  @Transform(trimOptionalNonEmpty)
  @IsString({ message: 'Judul halaman pendaftaran harus berupa teks' })
  @MaxLength(120, { message: 'Judul halaman maksimal 120 karakter' })
  judulHalaman?: string;

  @ApiPropertyOptional({
    example:
      'Formulir terpadu pendaftaran pasien rawat jalan baru maupun pasien lama',
    description: 'Subjudul keterangan halaman pendaftaran pasien',
  })
  @IsOptional()
  @Transform(trimOptionalNonEmpty)
  @IsString({ message: 'Subjudul halaman harus berupa teks' })
  @MaxLength(300, { message: 'Subjudul halaman maksimal 300 karakter' })
  subjudulHalaman?: string;

  @ApiPropertyOptional({
    example: 'Informasi Pasien yang Didaftarkan',
    description: 'Judul ringkasan setelah pendaftaran berhasil disimpan',
  })
  @IsOptional()
  @Transform(trimOptionalNonEmpty)
  @IsString({ message: 'Judul halaman sukses harus berupa teks' })
  @MaxLength(120, { message: 'Judul halaman sukses maksimal 120 karakter' })
  judulHalamanSukses?: string;

  @ApiPropertyOptional({
    example:
      'Ringkasan hasil registrasi kunjungan pasien beserta opsi cetak nomor antrean dan slip pendaftaran',
    description: 'Subjudul ringkasan setelah pendaftaran berhasil disimpan',
  })
  @IsOptional()
  @Transform(trimOptionalNonEmpty)
  @IsString({ message: 'Subjudul halaman sukses harus berupa teks' })
  @MaxLength(300, { message: 'Subjudul halaman sukses maksimal 300 karakter' })
  subjudulHalamanSukses?: string;
}

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({
    type: () => UpdateTenantNoRmSettingDto,
    description: 'Konfigurasi model & format Nomor Rekam Medis (No. RM) tenant',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantNoRmSettingDto)
  noRm?: UpdateTenantNoRmSettingDto;

  @ApiPropertyOptional({
    type: () => UpdateTenantPendaftaranSettingDto,
    description: 'Kustomisasi judul dan teks halaman pendaftaran per tenant',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantPendaftaranSettingDto)
  pendaftaran?: UpdateTenantPendaftaranSettingDto;
}

