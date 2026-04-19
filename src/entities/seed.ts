import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Menu } from '../entities/menu.entity';
import TenantSeeder from '../seeds/tenant.seeder';
import * as dotenv from 'dotenv';

dotenv.config();

const options: DataSourceOptions & SeederOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Tenant, User, Role, Menu],
  seeds: [TenantSeeder],
};

const dataSource = new DataSource(options);

dataSource.initialize().then(async () => {
  await runSeeders(dataSource);
  process.exit();
});