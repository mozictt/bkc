import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { LabParameter } from './lab-parameter.entity';

/**
 * Nilai normal & nilai kritis rujukan parameter lab berdasarkan jenis kelamin dan rentang umur (dalam hari).
 */
@Entity('master_lab_rujukan')
@Index('idx_lab_rujukan_param_gender', ['tenantId', 'parameterId', 'jenisKelamin'])
export class LabParameterRujukan extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'parameter_id', type: 'int' })
  parameterId: number;

  @ManyToOne('LabParameter', 'rujukanList', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parameter_id' })
  parameter: LabParameter;

  @Column({
    name: 'jenis_kelamin',
    type: 'varchar',
    length: 5,
    default: 'ALL',
  })
  jenisKelamin: string;

  @Column({ name: 'usia_min_hari', type: 'int', default: 0 })
  usiaMinHari: number;

  @Column({ name: 'usia_max_hari', type: 'int', default: 99999 })
  usiaMaxHari: number;

  @Column({ name: 'label_usia', type: 'varchar', length: 60, nullable: true })
  labelUsia: string | null;

  @Column({
    name: 'nilai_min',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  nilaiMin: string | null;

  @Column({
    name: 'nilai_max',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  nilaiMax: string | null;

  @Column({
    name: 'kritis_min',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  kritisMin: string | null;

  @Column({
    name: 'kritis_max',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  kritisMax: string | null;

  @Column({
    name: 'nilai_normal_text',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  nilaiNormalText: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  keterangan: string | null;
}
