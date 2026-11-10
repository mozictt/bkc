import { PartialType } from '@nestjs/swagger';
import { CreatePendudukDto } from './create-penduduk.dto';

export class UpdatePendudukDto extends PartialType(CreatePendudukDto) {}

