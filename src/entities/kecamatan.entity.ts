import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import type { Kabupaten } from './kabupaten.entity';
import type { Kelurahan } from './kelurahan.entity';

@Entity('kecamatan')
export class Kecamatan {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  nama: string;

  @Column({ name: 'kabupaten_id', type: 'varchar', length: 5 })
  kabupatenId: string;

  @ManyToOne('Kabupaten', 'kecamatan', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kabupaten_id' })
  kabupaten: Kabupaten;

  @OneToMany('Kelurahan', 'kecamatan')
  kelurahan: Kelurahan[];
}
