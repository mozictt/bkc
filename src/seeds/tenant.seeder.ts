import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tenant } from '../entities/tenant.entity';

export default class TenantSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Tenant);

    await repository.upsert(
      [
        {
          // id: '00000000-0000-0000-0000-000000000000',
          id: randomUUID(),
          name: 'Master Admin',
          slug: 'admin',
          isActive: true,
        },
      ],
      ['slug'], // Jangan duplikat jika slug sudah ada
    );
  }
}