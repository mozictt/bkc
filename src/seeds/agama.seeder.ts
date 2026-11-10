import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Agama } from '../entities/agama.entity';

export default class AgamaSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Agama);

    const data = [
      'Islam',
      'Kristen Protestan',
      'Kristen Katolik',
      'Hindu',
      'Buddha',
      'Konghucu',
      'Kepercayaan',
    ].map((nama) => ({ nama, status: 'Y' }));

    for (const item of data) {
      await repository.upsert(item, ['nama']);
    }
  }
}

