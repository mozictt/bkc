import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import type { Kabupaten } from './kabupaten.entity';

@Entity('provinsi')
export class Provinsi {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nama: string;

  @OneToMany('Kabupaten', 'provinsi')
  kabupaten: Kabupaten[];
}
