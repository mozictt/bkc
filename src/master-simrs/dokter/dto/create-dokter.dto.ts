import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePegawaiDto } from '@src/pegawai/dto/create-pegawai.dto';
import { CreatePendudukDto } from '../../penduduk/dto/create-penduduk.dto';
import { JenisDokter, StatusAktifMaster } from '../../constants/simrs.enum';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePegawaiForDokterDto extends OmitType(CreatePegawaiDto, [
  'pendudukId',
  'name',
] as const) {
  @ApiPropertyOptional({
    example: 'Budi Santoso',
    description:
      'Nama pegawai (opsional; otomatis mengambil namaLengkap penduduk jika dikosongkan)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Nama pegawai harus berupa teks' })
  @MaxLength(150, { message: 'Nama pegawai maksimal 150 karakter' })
  name?: string;
}

export class CreateDokterDto {
  @ApiProperty({
    example: 'DOK-001',
    description: 'Kode unik dokter di internal rumah sakit',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode dokter wajib diisi' })
  @IsString({ message: 'Kode dokter harus berupa teks' })
  @MaxLength(30, { message: 'Kode dokter maksimal 30 karakter' })
  kodeDokter: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Penduduk yang sudah ada (wajib diisi jika tidak mengirimkan object penduduk baru)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Penduduk harus berupa angka bulat' })
  @Min(1, { message: 'ID Penduduk tidak valid' })
  pendudukId?: number;

  @ApiPropertyOptional({
    type: () => CreatePendudukDto,
    description:
      'Payload data kependudukan baru (untuk input terpadu jika penduduk belum terdaftar)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePendudukDto)
  penduduk?: CreatePendudukDto;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID Pegawai yang sudah ada (opsional jika dokter mitra/tamu atau membuat pegawai baru)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Pegawai harus berupa angka bulat' })
  @Min(1, { message: 'ID Pegawai tidak valid' })
  pegawaiId?: number;

  @ApiPropertyOptional({
    type: () => CreatePegawaiForDokterDto,
    description:
      'Payload data kepegawaian baru (untuk input terpadu jika dokter sekaligus didaftarkan sebagai pegawai)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePegawaiForDokterDto)
  pegawai?: CreatePegawaiForDokterDto;

  @ApiPropertyOptional({ example: 'dr.', description: 'Gelar depan dokter' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30, { message: 'Gelar depan maksimal 30 karakter' })
  gelarDepan?: string;

  @ApiPropertyOptional({
    example: 'Sp.PD, FINASIM',
    description: 'Gelar belakang dokter',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80, { message: 'Gelar belakang maksimal 80 karakter' })
  gelarBelakang?: string;

  @ApiPropertyOptional({
    enum: JenisDokter,
    default: JenisDokter.UMUM,
    example: JenisDokter.SPESIALIS,
    description: 'Kategori profesi dokter',
  })
  @IsOptional()
  @IsEnum(JenisDokter, { message: 'Jenis dokter tidak valid' })
  jenisDokter?: JenisDokter;

  @ApiPropertyOptional({
    example: 'Penyakit Dalam',
    description: 'Bidang spesialisasi dokter',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100, { message: 'Spesialisasi maksimal 100 karakter' })
  spesialisasi?: string;

  @ApiPropertyOptional({
    example: '3211100123456789',
    description: 'Nomor Surat Tanda Registrasi (STR)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50, { message: 'Nomor STR maksimal 50 karakter' })
  noStr?: string;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description:
      'Menandakan STR berlaku seumur hidup (sesuai UU Kesehatan No. 17/2023)',
  })
  @IsOptional()
  @IsBoolean({ message: 'isStrSeumurHidup harus berupa boolean' })
  isStrSeumurHidup?: boolean;

  @ApiPropertyOptional({
    example: '2024-01-10',
    description: 'Tanggal terbit STR (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal terbit STR tidak valid (YYYY-MM-DD)' },
  )
  strTerbitPada?: string;

  @ApiPropertyOptional({
    example: '2029-01-10',
    description:
      'Tanggal berakhir STR (YYYY-MM-DD, kosongkan jika seumur hidup)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal berakhir STR tidak valid (YYYY-MM-DD)' },
  )
  strBerlakuSampai?: string;

  @ApiPropertyOptional({
    example: '503/SIP.001/DINKES/2024',
    description: 'Nomor Surat Izin Praktik (SIP) di fasilitas ini',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50, { message: 'Nomor SIP maksimal 50 karakter' })
  noSip?: string;

  @ApiPropertyOptional({
    example: '2024-02-01',
    description: 'Tanggal terbit SIP (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal terbit SIP tidak valid (YYYY-MM-DD)' },
  )
  sipTerbitPada?: string;

  @ApiPropertyOptional({
    example: '2029-02-01',
    description: 'Tanggal berakhir SIP (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal berakhir SIP tidak valid (YYYY-MM-DD)' },
  )
  sipBerlakuSampai?: string;

  @ApiPropertyOptional({
    example: '10009880728',
    description: 'ID Practitioner dari platform SATUSEHAT Kemenkes',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50, { message: 'IHS Practitioner ID maksimal 50 karakter' })
  ihsPractitionerId?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Kode Dokter DPJP BPJS (VClaim / Antrean Online HFIS)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30, { message: 'Kode BPJS maksimal 30 karakter' })
  kodeBpjs?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif dokter (Y = Aktif, N = Nonaktif)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}
