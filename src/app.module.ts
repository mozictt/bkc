// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { Company } from './company/company.entity';
import { Barang } from './barang/barang.entity';
import { CompanyModule } from './company/company.module';
import { BarangModule } from './barang/barang.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5434,
      username: 'root',
      password: 'root',
      database: 'app',
      entities: [User, Company, Barang],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    CompanyModule,
    BarangModule,
  ],
})
export class AppModule {}
