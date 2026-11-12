import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTarifTindakanDto } from './create-tarif-tindakan.dto';

export class UpdateTarifTindakanDto extends PartialType(
  OmitType(CreateTarifTindakanDto, ['tarifDefault', 'berlakuMulaiDefault'] as const),
) {}
