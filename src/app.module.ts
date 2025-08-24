import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { Barang } from './entities/barang.entity';
import { AuthModule } from '@auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { BarangModule } from './barang/barang.module';
import { Role } from '@entities/role.entity';
import { Menu } from '@entities/menu.entity';
import { MenuModule } from './menu/menu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // host: config.get('DB_HOST'),
        host: config.get<string>('DB_HOST') || 'localhost',
        // port: parseInt(config.get('DB_PORT'), 10),
        port: parseInt(config.get<string>('DB_PORT') || '5432', 10),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, Company, Barang, Role, Menu],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CompanyModule,
    BarangModule,
    MenuModule,
  ],
})
export class AppModule {}
