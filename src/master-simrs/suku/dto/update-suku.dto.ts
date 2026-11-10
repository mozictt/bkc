import { PartialType } from '@nestjs/mapped-types';
import { CreateSukuDto } from './create-suku.dto';

export class UpdateSukuDto extends PartialType(CreateSukuDto) {}

