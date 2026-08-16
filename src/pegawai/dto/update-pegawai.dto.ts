import { PartialType } from '@nestjs/swagger';
import { CreatePegawaiDto } from './create-pegawai.dto';

export class UpdatePegawaiDto extends PartialType(CreatePegawaiDto) {}
