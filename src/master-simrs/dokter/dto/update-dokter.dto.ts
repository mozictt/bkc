import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateDokterDto } from './create-dokter.dto';

export class UpdateDokterDto extends PartialType(
  OmitType(CreateDokterDto, ['penduduk', 'pegawai'] as const),
) {}

