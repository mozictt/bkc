import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('penjamin')
@Index('uq_penjamin_tenant_kode', ['tenantId', 'kode'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('uq_penjamin_tenant_nama', ['tenantId', 'nama'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Penjamin extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 120 })
  nama: string;

  @Column({
    name: 'jenis_penjamin',
    type: 'varchar',
    length: 30,
    default: 'ASURANSI_SWASTA',
  })
  jenisPenjamin: string;

  @Column({
    name: 'perusahaan_induk',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  perusahaanInduk: string | null;

  @Column({ name: 'no_telepon', type: 'varchar', length: 20, nullable: true })
  noTelepon: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  alamat: string | null;

  @Column({ name: 'pic_nama', type: 'varchar', length: 120, nullable: true })
  picNama: string | null;

  @Column({ name: 'pic_telepon', type: 'varchar', length: 20, nullable: true })
  picTelepon: string | null;

  @Column({ name: 'no_pks', type: 'varchar', length: 80, nullable: true })
  noPks: string | null;

  @Column({ name: 'pks_berlaku_sampai', type: 'date', nullable: true })
  pksBerlakuSampai: string | null;

  @Column({
    name: 'kode_eksternal_bpjs',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  kodeEksternalBpjs: string | null;

  @Column({ name: 'butuh_no_kartu', type: 'boolean', default: true })
  butuhNoKartu: boolean;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}

