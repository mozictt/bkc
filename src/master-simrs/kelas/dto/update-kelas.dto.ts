import { PartialType } from '@nestjs/swagger';
import { CreateKelasDto } from './create-kelas.dto';

export class UpdateKelasDto extends PartialType(CreateKelasDto) {}

