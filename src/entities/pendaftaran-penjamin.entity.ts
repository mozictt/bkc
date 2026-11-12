import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Pendaftaran } from './pendaftaran.entity';
import type { Penjamin } from './penjamin.entity';
import type { PasienPenjamin } from './pasien-penjamin.entity';
import type { Kelas } from './kelas.entity';

/**
 * Snapshot penjamin kunjungan (1 kunjungan bisa memiliki 1 atau lebih penjamin / COB).
 * Penjamin dengan `isUtama = true` (`urutan = 1`) dicerminkan ke kolom flat tabel `pendaftaran`
 * agar kompatibilitas modul lain dan query kuota BPJS tetap terjaga.
 */
@Entity('pendaftaran_penjamin')
@Index(
  'uq_ppj_tenant_pendaftaran_urutan',
  ['tenantId', 'pendaftaranId', 'urutan'],
  { unique: true },
)
@Index('uq_ppj_tenant_pendaftaran_utama', ['tenantId', 'pendaftaranId'], {
  unique: true,
  where: `"is_utama" = true`,
})
@Index('idx_ppj_tenant_pendaftaran', ['tenantId', 'pendaftaranId'])
@Index('idx_ppj_tenant_penjamin', ['tenantId', 'penjaminId'])
@Index('idx_ppj_tenant_jenis_penjamin', ['tenantId', 'jenisPenjamin'])
export class PendaftaranPenjamin extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pendaftaran_id', type: 'int' })
  pendaftaranId: number;

  @ManyToOne('Pendaftaran', 'penjaminList', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pendaftaran_id' })
  pendaftaran: Pendaftaran;

  @Column({ type: 'int', default: 1 })
  urutan: number;

  @Column({ name: 'is_utama', type: 'boolean', default: false })
  isUtama: boolean;

  @Column({ name: 'jenis_penjamin', type: 'varchar', length: 30 })
  jenisPenjamin: string;

  @Column({ name: 'penjamin_id', type: 'int', nullable: true })
  penjaminId: number | null;

  @ManyToOne('Penjamin', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'penjamin_id' })
  penjamin: Penjamin | null;

  @Column({ name: 'pasien_penjamin_id', type: 'int', nullable: true })
  pasienPenjaminId: number | null;

  @ManyToOne('PasienPenjamin', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pasien_penjamin_id' })
  pasienPenjamin: PasienPenjamin | null;

  @Column({
    name: 'nama_penjamin_snapshot',
    type: 'varchar',
    length: 120,
  })
  namaPenjaminSnapshot: string;

  @Column({
    name: 'no_kartu_snapshot',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  noKartuSnapshot: string | null;

  @Column({ name: 'kelas_hak_id_snapshot', type: 'int', nullable: true })
  kelasHakIdSnapshot: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_hak_id_snapshot' })
  kelasHakSnapshot: Kelas | null;

  @Column({ name: 'no_sep', type: 'varchar', length: 50, nullable: true })
  noSep: string | null;

  @Column({ name: 'no_rujukan', type: 'varchar', length: 50, nullable: true })
  noRujukan: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  keterangan: string | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;
}
