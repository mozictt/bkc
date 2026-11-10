import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePendudukDto } from '../../penduduk/dto/create-penduduk.dto';
import {
  FormatNoRm,
  HubunganPenanggungJawab,
  StatusAktifMaster,
} from '../../constants/simrs.enum';
import { CreatePasienPenjaminItemDto } from './pasien-penjamin.dto';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreatePasienDto {
  @ApiPropertyOptional({
    example: '00000001',
    description:
      'Nomor Rekam Medis (opsional untuk migrasi data lama; jika dikosongkan akan di-generate otomatis)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Nomor RM harus berupa teks' })
  @MaxLength(30, { message: 'Nomor RM maksimal 30 karakter' })
  noRm?: string;

  @ApiPropertyOptional({
    enum: FormatNoRm,
    example: FormatNoRm.PLAIN_8,
    description:
      'Format auto-generate No. RM (PLAIN_8 = 00000001, DASH_6 = 00-00-01). Mengikuti pengaturan tenant jika dikosongkan.',
  })
  @IsOptional()
  @IsEnum(FormatNoRm, {
    message: 'Format No. RM hanya boleh PLAIN_8 atau DASH_6',
  })
  formatNoRm?: FormatNoRm;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Penduduk yang sudah ada (mis. pegawai/dokter/eks pasien; wajib diisi jika tidak mengirim objek penduduk)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Penduduk harus berupa angka bulat' })
  @Min(1, { message: 'ID Penduduk tidak valid' })
  pendudukId?: number;

  @ApiPropertyOptional({
    type: () => CreatePendudukDto,
    description:
      'Payload data kependudukan baru (untuk registrasi pasien baru terpadu)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePendudukDto)
  penduduk?: CreatePendudukDto;

  @ApiPropertyOptional({
    example: 12,
    description: 'ID Penduduk ibu kandung (khusus kasus bayi baru lahir)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Penduduk Ibu harus berupa angka bulat' })
  @Min(1, { message: 'ID Penduduk Ibu tidak valid' })
  pendudukIbuId?: number;

  @ApiPropertyOptional({
    default: false,
    example: false,
    description: 'Tandai jika pasien adalah bayi baru lahir (belum ber-NIK)',
  })
  @IsOptional()
  @IsBoolean({ message: 'isBayiBaruLahir harus berupa boolean' })
  isBayiBaruLahir?: boolean;

  @ApiPropertyOptional({
    default: false,
    example: false,
    description:
      'Tandai jika pasien IGD tanpa identitas (Mr. X / Mrs. X sementara)',
  })
  @IsOptional()
  @IsBoolean({ message: 'isIdentitasTidakDiketahui harus berupa boolean' })
  isIdentitasTidakDiketahui?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: 'Apakah alamat domisili sama dengan alamat KTP pada penduduk',
  })
  @IsOptional()
  @IsBoolean({ message: 'alamatSamaKtp harus berupa boolean' })
  alamatSamaKtp?: boolean;

  @ApiPropertyOptional({
    example: 'Jl. Dago Asri No. 12',
    description: 'Alamat domisili saat ini (diisi jika alamatSamaKtp = false)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Alamat domisili maksimal 500 karakter' })
  alamatDomisili?: string;

  @ApiPropertyOptional({
    example: '32.73.08.1001',
    description: 'ID Kelurahan domisili (BPS/Kemendagri)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(13, { message: 'ID Kelurahan domisili maksimal 13 karakter' })
  idKelurahanDomisili?: string;

  @ApiPropertyOptional({ example: '003', description: 'RT domisili' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(5, { message: 'RT domisili maksimal 5 karakter' })
  rtDomisili?: string;

  @ApiPropertyOptional({ example: '005', description: 'RW domisili' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(5, { message: 'RW domisili maksimal 5 karakter' })
  rwDomisili?: string;

  @ApiPropertyOptional({
    example: 'Siti Aminah',
    description: 'Nama lengkap penanggung jawab / kontak darurat',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(150, { message: 'Nama penanggung jawab maksimal 150 karakter' })
  namaPj?: string;

  @ApiPropertyOptional({
    enum: HubunganPenanggungJawab,
    example: HubunganPenanggungJawab.PASANGAN,
    description: 'Hubungan penanggung jawab dengan pasien',
  })
  @IsOptional()
  @IsEnum(HubunganPenanggungJawab, {
    message: 'Hubungan penanggung jawab tidak valid',
  })
  hubunganPj?: HubunganPenanggungJawab;

  @ApiPropertyOptional({
    example: '081298765432',
    description: 'Nomor HP penanggung jawab / kontak darurat',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, {
    message:
      'Nomor HP penanggung jawab hanya boleh berisi angka, spasi, tanda + atau -',
  })
  @MaxLength(20, { message: 'Nomor HP penanggung jawab maksimal 20 karakter' })
  noHpPj?: string;

  @ApiPropertyOptional({
    example: 'Jl. Merdeka No. 8',
    description: 'Alamat penanggung jawab',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Alamat penanggung jawab maksimal 500 karakter' })
  alamatPj?: string;

  @ApiPropertyOptional({
    example: 'Alergi antibiotik golongan penisilin',
    description: 'Catatan alergi atau kondisi khusus ringkas pasien',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan penting maksimal 1000 karakter' })
  catatanPenting?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif master pasien (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    type: () => [CreatePasienPenjaminItemDto],
    description:
      'Daftar penjamin / asuransi pasien (1 pasien bisa memiliki banyak penjamin)',
  })
  @IsOptional()
  @IsArray({ message: 'penjaminList harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => CreatePasienPenjaminItemDto)
  penjaminList?: CreatePasienPenjaminItemDto[];
}

