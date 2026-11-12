import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { TarifTindakan } from './tarif-tindakan.entity';
import type { LabParameter } from './lab-parameter.entity';

/**
 * Pemetaan Many-to-Many antara item TarifTindakan (LABORATORIUM) seperti "Darah Lengkap"
 * dengan banyak LabParameter beserta urutan tampilnya.
 */
@Entity('master_lab_tindakan_parameter')
@Index(
  'uq_lab_tindakan_param_tenant',
  ['tenantId', 'tindakanId', 'parameterId'],
  { unique: true },
)
@Index('idx_lab_tindakan_param_order', ['tenantId', 'tindakanId', 'urutan'])
export class LabTindakanParameter extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'tindakan_id', type: 'int' })
  tindakanId: number;

  @ManyToOne('TarifTindakan', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tindakan_id' })
  tindakan: TarifTindakan;

  @Index()
  @Column({ name: 'parameter_id', type: 'int' })
  parameterId: number;

  @ManyToOne('LabParameter', 'tindakanMappings', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parameter_id' })
  parameter: LabParameter;

  @Column({ type: 'int', default: 0 })
  urutan: number;

  @Column({
    name: 'sub_grup_label',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  subGrupLabel: string | null;

  @Column({ name: 'is_wajib', type: 'boolean', default: true })
  isWajib: boolean;
}
