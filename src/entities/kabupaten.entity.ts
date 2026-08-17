import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import type { Provinsi } from './provinsi.entity';
import type { Kecamatan } from './kecamatan.entity';

@Entity('kabupaten')
export class Kabupaten {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  nama: string;

  @Column({ name: 'provinsi_id', type: 'varchar', length: 2 })
  provinsiId: string;

  @ManyToOne('Provinsi', 'kabupaten', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provinsi_id' })
  provinsi: Provinsi;

  @OneToMany('Kecamatan', 'kabupaten')
  kecamatan: Kecamatan[];
}
