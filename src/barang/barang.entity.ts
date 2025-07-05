import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('barang')
export class Barang {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nama: string;

  @Column('int')
  harga: number;

  @Column('int')
  stok: number;

  @Column({ nullable: true })
  deskripsi: string;
}
