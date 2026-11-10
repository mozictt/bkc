import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePasienDto } from './create-pasien.dto';

export class UpdatePasienDto extends PartialType(
  OmitType(CreatePasienDto, [
    'penduduk',
    'formatNoRm',
    'penjaminList',
  ] as const),
) {}
