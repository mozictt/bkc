import { PartialType } from '@nestjs/swagger';
import { CreatePenjaminDto } from './create-penjamin.dto';

export class UpdatePenjaminDto extends PartialType(CreatePenjaminDto) {}

