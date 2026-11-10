import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import {
  GolonganDarah,
  JenisIdentitas,
  JenisKelamin,
  Kewarganegaraan,
  RhesusDarah,
  StatusHidup,
  StatusPerkawinan,
} from '../../constants/simrs.enum';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Ubah string kosong "" dari form frontend menjadi undefined agar validasi opsional (@Matches, @IsEmail, @IsDateString) tidak gagal pada kasus bayi/IGD
const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreatePendudukDto {
  @ApiPropertyOptional({
    enum: JenisIdentitas,
    default: JenisIdentitas.KTP,
    example: JenisIdentitas.KTP,
    description: 'Jenis identitas utama penduduk',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(JenisIdentitas, { message: 'Jenis identitas tidak valid' })
  jenisIdentitas?: JenisIdentitas;

  @ApiPropertyOptional({
    example: '3273011505900001',
    description: 'Nomor Induk Kependudukan (16 digit angka)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'NIK harus berupa teks' })
  @Matches(/^\d{16}$/, {
    message: 'NIK harus terdiri dari tepat 16 digit angka',
  })
  nik?: string;

  @ApiPropertyOptional({
    example: 'A1234567',
    description:
      'Nomor identitas selain NIK (Paspor / KITAS / KITAP / KIA untuk WNA atau anak)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Nomor identitas lain harus berupa teks' })
  @MaxLength(50, { message: 'Nomor identitas lain maksimal 50 karakter' })
  noIdentitasLain?: string;

  @ApiPropertyOptional({
    example: '3273011505900099',
    description: 'Nomor Kartu Keluarga (16 digit angka)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'No. KK harus berupa teks' })
  @Matches(/^\d{16}$/, {
    message: 'No. KK harus terdiri dari tepat 16 digit angka',
  })
  noKk?: string;

  @ApiProperty({
    example: 'Budi Santoso',
    description: 'Nama lengkap sesuai KTP (tanpa gelar)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString({ message: 'Nama lengkap harus berupa teks' })
  @MaxLength(150, { message: 'Nama lengkap maksimal 150 karakter' })
  namaLengkap: string;

  @ApiPropertyOptional({
    example: 'Siti Aminah',
    description: 'Nama ibu kandung untuk verifikasi identitas & MPI SATUSEHAT',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Nama ibu kandung harus berupa teks' })
  @MaxLength(150, { message: 'Nama ibu kandung maksimal 150 karakter' })
  namaIbuKandung?: string;

  @ApiPropertyOptional({
    example: 'Bandung',
    description: 'Tempat lahir sesuai KTP',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100, { message: 'Tempat lahir maksimal 100 karakter' })
  tempatLahir?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Tanggal lahir format YYYY-MM-DD',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString(
    {},
    { message: 'Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)' },
  )
  tanggalLahir?: string;

  @ApiProperty({
    enum: JenisKelamin,
    example: JenisKelamin.LAKI_LAKI,
    description: 'Jenis kelamin (L = Laki-laki, P = Perempuan)',
  })
  @IsNotEmpty({ message: 'Jenis kelamin wajib diisi' })
  @IsEnum(JenisKelamin, { message: 'Jenis kelamin hanya boleh L atau P' })
  jenisKelamin: JenisKelamin;

  @ApiPropertyOptional({
    enum: GolonganDarah,
    example: GolonganDarah.O,
    description: 'Golongan darah penduduk',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(GolonganDarah, { message: 'Golongan darah tidak valid' })
  golonganDarah?: GolonganDarah;

  @ApiPropertyOptional({
    enum: RhesusDarah,
    example: RhesusDarah.POSITIF,
    description: 'Rhesus darah (+ atau -)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(RhesusDarah, { message: 'Rhesus hanya boleh + atau -' })
  rhesus?: RhesusDarah;

  @ApiPropertyOptional({
    enum: StatusPerkawinan,
    example: StatusPerkawinan.KAWIN,
    description: 'Status perkawinan sesuai KTP',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(StatusPerkawinan, { message: 'Status perkawinan tidak valid' })
  statusPerkawinan?: StatusPerkawinan;

  @ApiPropertyOptional({
    enum: Kewarganegaraan,
    default: Kewarganegaraan.WNI,
    example: Kewarganegaraan.WNI,
    description: 'Kewarganegaraan penduduk',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(Kewarganegaraan, {
    message: 'Kewarganegaraan hanya boleh WNI atau WNA',
  })
  kewarganegaraan?: Kewarganegaraan;

  @ApiPropertyOptional({
    enum: StatusHidup,
    default: StatusHidup.HIDUP,
    example: StatusHidup.HIDUP,
    description: 'Status hidup penduduk (HIDUP / MENINGGAL)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEnum(StatusHidup, { message: 'Status hidup tidak valid' })
  statusHidup?: StatusHidup;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Tanggal meninggal format YYYY-MM-DD (jika sudah meninggal)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString(
    {},
    { message: 'Format tanggal meninggal tidak valid (gunakan YYYY-MM-DD)' },
  )
  tanggalMeninggal?: string;

  @ApiPropertyOptional({
    example: 'Jl. Asia Afrika No. 10',
    description: 'Alamat lengkap sesuai KTP',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Alamat KTP maksimal 500 karakter' })
  alamatKtp?: string;

  @ApiPropertyOptional({ example: '001', description: 'Nomor RT' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(5, { message: 'RT maksimal 5 karakter' })
  rt?: string;

  @ApiPropertyOptional({ example: '002', description: 'Nomor RW' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(5, { message: 'RW maksimal 5 karakter' })
  rw?: string;

  @ApiPropertyOptional({ example: '40111', description: 'Kode pos alamat KTP' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(10, { message: 'Kode pos maksimal 10 karakter' })
  kodePos?: string;

  @ApiPropertyOptional({
    example: '081234567890',
    description: 'Nomor telepon/HP aktif',
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
    example: 'budi@example.com',
    description: 'Alamat email',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email?: string;

  @ApiPropertyOptional({
    example: '32.73.08.1001',
    description: 'ID Kelurahan (BPS/Kemendagri, 13 karakter)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(13, { message: 'ID Kelurahan maksimal 13 karakter' })
  idKelurahan?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID Master Agama' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Agama harus berupa angka bulat' })
  @Min(1, { message: 'ID Agama tidak valid' })
  agamaId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID Master Pendidikan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Pendidikan harus berupa angka bulat' })
  @Min(1, { message: 'ID Pendidikan tidak valid' })
  pendidikanId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID Master Pekerjaan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Pekerjaan harus berupa angka bulat' })
  @Min(1, { message: 'ID Pekerjaan tidak valid' })
  pekerjaanId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID Master Suku' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Suku harus berupa angka bulat' })
  @Min(1, { message: 'ID Suku tidak valid' })
  sukuId?: number;

  @ApiPropertyOptional({
    example: 'P02280547535',
    description: 'ID IHS Patient dari platform SATUSEHAT Kemenkes',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'IHS Patient ID maksimal 50 karakter' })
  ihsPatientId?: string;
}
