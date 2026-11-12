import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePasienDto } from '@src/master-simrs/pasien/dto/create-pasien.dto';
import { JenisPenjamin } from '@src/master-simrs/constants/simrs.enum';
import { trimOptionalString } from '@src/master-simrs/helpers/master-entity.helper';
import { CaraMasukPasien } from '../constants/pendaftaran.enum';

const optionalPositiveInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return Number(value);
};

export class CreatePendaftaranPenjaminItemDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'Urutan penagihan penjamin (1 = Penjamin Utama, 2 = COB Sekunder, dst.)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'Urutan penjamin harus berupa angka bulat' })
  @Min(1, { message: 'Urutan penjamin minimal 1' })
  urutan?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Menandai penjamin utama kunjungan (penentu antrean/kuota dan penagihan pertama)',
  })
  @IsOptional()
  @IsBoolean({ message: 'isUtama harus berupa boolean' })
  isUtama?: boolean;

  @ApiPropertyOptional({
    enum: JenisPenjamin,
    example: JenisPenjamin.BPJS,
    description:
      'Jenis cara bayar / penjamin item (UMUM, BPJS, ASURANSI_SWASTA, PERUSAHAAN, KEMENKES, LAINNYA)',
  })
  @IsOptional()
  @IsEnum(JenisPenjamin, { message: 'Jenis penjamin tidak valid' })
  jenisPenjamin?: JenisPenjamin;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Master Penjamin (opsional untuk UMUM; dapat diisi untuk memilih BPJS / Asuransi)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Master Penjamin harus berupa angka bulat' })
  @Min(1, { message: 'ID Master Penjamin tidak valid' })
  penjaminId?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'ID Penjamin Pasien (FK ke pasien_penjamin) milik pasien eksisting',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Penjamin Pasien harus berupa angka bulat' })
  @Min(1, { message: 'ID Penjamin Pasien tidak valid' })
  pasienPenjaminId?: number;

  @ApiPropertyOptional({
    example: '0001234567890',
    description:
      'Nomor kartu BPJS / nomor polis asuransi (wajib jika penjamin butuhNoKartu = true)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor kartu maksimal 50 karakter' })
  noKartu?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'ID Master Kelas hak perawatan peserta asuransi/BPJS',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Kelas hak harus berupa angka bulat' })
  @Min(1, { message: 'ID Kelas hak tidak valid' })
  kelasHakId?: number;

  @ApiPropertyOptional({
    example: 'Puskesmas Coblong',
    description: 'Faskes perujuk peserta (untuk penyimpanan profil penjamin)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120, { message: 'Faskes perujuk maksimal 120 karakter' })
  faskesPerujuk?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Masa berlaku kartu/polis asuransi (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString({}, { message: 'Format berlakuSampai tidak valid' })
  berlakuSampai?: string;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description:
      'Otomatis simpan penjamin baru ke profil pasien (pasien_penjamin) jika belum terdaftar',
  })
  @IsOptional()
  @IsBoolean({ message: 'simpanKeProfilPasien harus berupa boolean' })
  simpanKeProfilPasien?: boolean;

  @ApiPropertyOptional({
    example: '0101R0011126V000001',
    description: 'Nomor SEP / Surat Jaminan Asuransi',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor SEP maksimal 50 karakter' })
  noSep?: string;

  @ApiPropertyOptional({
    example: '010101011126P000001',
    description: 'Nomor rujukan FKTP / RS perujuk',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor rujukan maksimal 50 karakter' })
  noRujukan?: string;

  @ApiPropertyOptional({
    example: 'COB Mandiri Inhealth menutup selisih kelas VIP',
    description: 'Catatan khusus penjamin pada kunjungan ini (mis. skema COB)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(255, { message: 'Keterangan maksimal 255 karakter' })
  keterangan?: string;
}

export class CreatePendaftaranDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Master Pasien eksisting (wajib diisi jika tidak mengirim objek pasienBaru)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Pasien harus berupa angka bulat' })
  @Min(1, { message: 'ID Pasien tidak valid' })
  pasienId?: number;

  @ApiPropertyOptional({
    type: () => CreatePasienDto,
    description:
      'Payload registrasi pasien baru terpadu (penduduk + RM + penjamin) dalam 1 transaksi atomik',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePasienDto)
  pasienBaru?: CreatePasienDto;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description:
      'Tanggal kunjungan (YYYY-MM-DD). Jika dikosongkan otomatis menggunakan tanggal hari ini.',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format tanggalKunjungan harus YYYY-MM-DD',
  })
  tanggalKunjungan?: string;

  @ApiProperty({
    example: 1,
    description:
      'ID Master Unit tujuan pendaftaran awal (Poliklinik Rajal / IGD / Ruang Rawat Inap / Intensive)',
  })
  @IsNotEmpty({ message: 'ID Unit tujuan wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Unit harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit tidak valid' })
  unitId: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Jadwal Dokter praktik (wajib untuk unit RAWAT_JALAN; opsional untuk IGD/RAWAT_INAP)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Jadwal Dokter harus berupa angka bulat' })
  @Min(1, { message: 'ID Jadwal Dokter tidak valid' })
  jadwalDokterId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Dokter penanggung jawab / DPJP (wajib jika jadwalDokterId tidak diisi)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Dokter harus berupa angka bulat' })
  @Min(1, { message: 'ID Dokter tidak valid' })
  dokterId?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'ID Bed kosong (wajib untuk unit RAWAT_INAP / INTENSIVE; opsional untuk IGD)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Bed harus berupa angka bulat' })
  @Min(1, { message: 'ID Bed tidak valid' })
  bedId?: number;

  @ApiPropertyOptional({
    enum: JenisPenjamin,
    example: JenisPenjamin.UMUM,
    description:
      'Jenis cara bayar / penjamin kunjungan (UMUM, BPJS, ASURANSI_SWASTA, PERUSAHAAN, KEMENKES, LAINNYA)',
  })
  @IsOptional()
  @IsEnum(JenisPenjamin, { message: 'Jenis penjamin tidak valid' })
  jenisPenjamin?: JenisPenjamin;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Master Penjamin (opsional untuk UMUM; dapat diisi untuk memilih BPJS / Asuransi)',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Master Penjamin harus berupa angka bulat' })
  @Min(1, { message: 'ID Master Penjamin tidak valid' })
  penjaminId?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'ID Penjamin Pasien (FK ke pasien_penjamin) milik pasien eksisting',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Penjamin Pasien harus berupa angka bulat' })
  @Min(1, { message: 'ID Penjamin Pasien tidak valid' })
  pasienPenjaminId?: number;

  @ApiPropertyOptional({
    example: '0001234567890',
    description:
      'Nomor kartu BPJS / nomor polis asuransi (wajib jika penjamin butuhNoKartu = true)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor kartu maksimal 50 karakter' })
  noKartu?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'ID Master Kelas hak perawatan peserta asuransi/BPJS',
  })
  @IsOptional()
  @Transform(optionalPositiveInt)
  @IsInt({ message: 'ID Kelas hak harus berupa angka bulat' })
  @Min(1, { message: 'ID Kelas hak tidak valid' })
  kelasHakId?: number;

  @ApiPropertyOptional({
    example: 'Puskesmas Coblong',
    description: 'Faskes perujuk peserta (untuk penyimpanan profil penjamin)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120, { message: 'Faskes perujuk maksimal 120 karakter' })
  faskesPerujuk?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Masa berlaku kartu/polis asuransi (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString({}, { message: 'Format berlakuSampai tidak valid' })
  berlakuSampai?: string;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description:
      'Otomatis simpan penjamin baru ke profil pasien (pasien_penjamin) jika belum terdaftar',
  })
  @IsOptional()
  @IsBoolean({ message: 'simpanKeProfilPasien harus berupa boolean' })
  simpanKeProfilPasien?: boolean;

  @ApiPropertyOptional({
    example: '0101R0011126V000001',
    description: 'Nomor SEP / Surat Jaminan Asuransi',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor SEP maksimal 50 karakter' })
  noSep?: string;

  @ApiPropertyOptional({
    example: '010101011126P000001',
    description: 'Nomor rujukan FKTP / RS perujuk',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Nomor rujukan maksimal 50 karakter' })
  noRujukan?: string;

  @ApiPropertyOptional({
    type: () => [CreatePendaftaranPenjaminItemDto],
    description:
      'Daftar penjamin kunjungan (mendukung multi-penjamin / COB). Jika diisi, field penjamin flat akan mengikuti penjamin utama (urutan 1 / isUtama = true).',
  })
  @IsOptional()
  @IsArray({ message: 'penjaminList harus berupa array' })
  @ArrayMinSize(1, {
    message: 'penjaminList minimal berisi 1 penjamin jika dikirim',
  })
  @ArrayMaxSize(10, {
    message: 'Maksimal 10 penjamin dalam satu kunjungan',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePendaftaranPenjaminItemDto)
  penjaminList?: CreatePendaftaranPenjaminItemDto[];

  @ApiPropertyOptional({
    enum: CaraMasukPasien,
    default: CaraMasukPasien.DATANG_SENDIRI,
    example: CaraMasukPasien.DATANG_SENDIRI,
    description: 'Cara masuk pasien ke fasilitas pelayanan',
  })
  @IsOptional()
  @IsEnum(CaraMasukPasien, { message: 'Cara masuk pasien tidak valid' })
  caraMasuk?: CaraMasukPasien;

  @ApiPropertyOptional({
    example: 'Klinik Pratama Sehat',
    description: 'Nama fasilitas asal rujukan jika pasien rujukan',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(150, { message: 'Asal rujukan maksimal 150 karakter' })
  asalRujukan?: string;

  @ApiPropertyOptional({
    example: 'Demam sejak 3 hari lalu disertai pusing',
    description: 'Keluhan utama saat pendaftaran',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Keluhan utama maksimal 1000 karakter' })
  keluhanUtama?: string;

  @ApiPropertyOptional({
    example: 'Pasien membawa hasil lab eksternal',
    description: 'Catatan tambahan petugas pendaftaran',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan maksimal 1000 karakter' })
  catatan?: string;

  @ApiPropertyOptional({
    example: 'enc-12345678-aaaa-bbbb-cccc-123456789012',
    description: 'ID Encounter SATUSEHAT (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'IHS Encounter ID maksimal 50 karakter' })
  ihsEncounterId?: string;
}

