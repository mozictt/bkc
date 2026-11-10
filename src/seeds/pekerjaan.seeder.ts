import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Pekerjaan } from '../entities/pekerjaan.entity';

export default class PekerjaanSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Pekerjaan);

    const data = [
      'Pegawai Negeri Sipil (PNS)',
      'Tentara Nasional Indonesia (TNI)',
      'Kepolisian RI (Polri)',
      'Pegawai Swasta',
      'Wiraswasta/Wirausaha',
      'Petani',
      'Nelayan',
      'Buruh',
      'Pedagang',
      'Pelajar/Mahasiswa',
      'Ibu Rumah Tangga',
      'Pensiunan',
      'Tidak Bekerja',
      'Lain-lain',
    ].map((nama) => ({ nama, status: 'Y' }));

    for (const item of data) {
      await repository.upsert(item, ['nama']);
    }
  }
}

