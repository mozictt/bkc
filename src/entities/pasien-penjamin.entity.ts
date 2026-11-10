import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import type { Pasien } from './pasien.entity';
import type { Penjamin } from './penjamin.entity';
import type { Kelas } from './kelas.entity';

@Entity('pasien_penjamin')
@Index('idx_pasien_penjamin_tenant_pasien', ['tenantId', 'pasienId'])
@Index('idx_pasien_penjamin_tenant_penjamin', ['tenantId', 'penjaminId'])
@Index('idx_pasien_penjamin_tenant_nokartu', ['tenantId', 'noKartu'])
@Index(
  'uq_pasien_penjamin_kartu_aktif',
  ['tenantId', 'pasienId', 'penjaminId', 'noKartu'],
  {
    unique: true,
    where: '"deleted_at" IS NULL AND "no_kartu" IS NOT NULL',
  },
)
@Index('uq_pasien_penjamin_utama', ['tenantId', 'pasienId'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "is_utama" = true',
})
export class PasienPenjamin extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'pasien_id', type: 'int' })
  pasienId: number;

  @ManyToOne('Pasien', 'penjaminList', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pasien_id' })
  pasien: Pasien;

  @Index()
  @Column({ name: 'penjamin_id', type: 'int' })
  penjaminId: number;

  @ManyToOne('Penjamin', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'penjamin_id' })
  penjamin: Penjamin;

  @Column({ name: 'no_kartu', type: 'varchar', length: 50, nullable: true })
  noKartu: string | null;

  @Index()
  @Column({ name: 'kelas_hak_id', type: 'int', nullable: true })
  kelasHakId: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_hak_id' })
  kelasHak: Kelas | null;

  @Column({
    name: 'faskes_perujuk',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  faskesPerujuk: string | null;

  @Column({ name: 'berlaku_sampai', type: 'date', nullable: true })
  berlakuSampai: string | null;

  @Column({ name: 'is_utama', type: 'boolean', default: false })
  isUtama: boolean;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
