import { PartialType } from '@nestjs/mapped-types';
import { CreateAgamaDto } from './create-agama.dto';

export class UpdateAgamaDto extends PartialType(CreateAgamaDto) {}

