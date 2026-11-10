import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Suku } from '../entities/suku.entity';

export default class SukuSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Suku);

    const data = [
      'Jawa',
      'Sunda',
      'Batak',
      'Minangkabau',
      'Bugis',
      'Madura',
      'Betawi',
      'Melayu',
      'Aceh',
      'Bali',
      'Nias',
      'Dayak',
      'Sasak',
      'Makassar',
      'Palembang',
      'Banjar',
      'Toraja',
      'Flores',
      'Ambon',
      'Papua',
      'Lain-lain',
    ].map((nama) => ({ nama, status: 'Y' }));

    for (const item of data) {
      await repository.upsert(item, ['nama']);
    }
  }
}

