import { PartialType } from '@nestjs/mapped-types';
import { CreatePendidikanDto } from './create-pendidikan.dto';

export class UpdatePendidikanDto extends PartialType(CreatePendidikanDto) {}

