import { PartialType } from '@nestjs/mapped-types';
import { CreatePekerjaanDto } from './create-pekerjaan.dto';

export class UpdatePekerjaanDto extends PartialType(CreatePekerjaanDto) {}

