import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { JenisTarif, StatusAktifMaster } from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';
import { TarifKomponenDto } from './tarif-layanan.dto';

export class CreateTarifTindakanDto {
  @ApiProperty({
    example: 'TRF-POLI-001',
    description: 'Kode unik tindakan/pemeriksaan per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode tarif/tindakan wajib diisi' })
  @IsString({ message: 'Kode tarif harus berupa teks' })
  @MaxLength(30, { message: 'Kode tarif maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'Konsultasi Dokter Spesialis',
    description: 'Nama tindakan medis, pemeriksaan lab, atau pemeriksaan radiologi',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama tindakan wajib diisi' })
  @IsString({ message: 'Nama tindakan harus berupa teks' })
  @MaxLength(180, { message: 'Nama tindakan maksimal 180 karakter' })
  nama: string;

  @ApiProperty({
    enum: JenisTarif,
    default: JenisTarif.BIASA,
    example: JenisTarif.BIASA,
    description: 'Kategori tarif: BIASA, LABORATORIUM, atau RADIOLOGI',
  })
  @IsNotEmpty({ message: 'Jenis tarif wajib dipilih' })
  @IsEnum(JenisTarif, {
    message: 'Jenis tarif harus BIASA, LABORATORIUM, atau RADIOLOGI',
  })
  jenisTarif: JenisTarif;

  @ApiPropertyOptional({
    example: 'Konsultasi',
    description: 'Subkelompok layanan (mis: Konsultasi, Hematologi, Rontgen, USG)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80, { message: 'Kelompok tarif maksimal 80 karakter' })
  kelompokTarif?: string;

  @ApiPropertyOptional({
    default: 'Tindakan',
    example: 'Pemeriksaan',
    description: 'Satuan hitung tindakan saat billing',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30, { message: 'Satuan maksimal 30 karakter' })
  satuan?: string;

  @ApiPropertyOptional({
    example: '89.03',
    description: 'Kode referensi eksternal (ICD-9-CM, LOINC, atau Kode Kemenkes/BPJS)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'Kode eksternal maksimal 50 karakter' })
  kodeEksternal?: string;

  @ApiPropertyOptional({
    example: { spesimen: 'Darah EDTA', butuhPuasa: false, estimasiHasilJam: 2 },
    description: 'Metadata tambahan spesifik untuk Lab atau Radiologi',
  })
  @IsOptional()
  @IsObject({ message: 'Atribut khusus harus berupa objek JSON' })
  atributKhusus?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Meliputi pemeriksaan fisik dan konsultasi dokter penanggung jawab',
    description: 'Keterangan tambahan tindakan',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    description: 'Status aktif master tindakan (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    type: TarifKomponenDto,
    description:
      'Opsional: langsung membuat aturan tarif dasar global (Semua Unit/Penjamin/Kelas) saat tindakan dibuat',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TarifKomponenDto)
  tarifDefault?: TarifKomponenDto;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Tanggal berlaku mulai untuk tarifDefault bila diisi',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal berlaku mulai tidak valid' })
  berlakuMulaiDefault?: string;
}
