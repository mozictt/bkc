import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { BarangModule } from './barang/module/barang.module';
import { KategoriModule } from './barang/module/kategori.module';
import { CommonModule } from './common/common.module';
import { MenuModule } from './menu/menu.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { TenantContextService } from './common/tenant/tenant-context.service';

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
        timezone: config.get<string>('APP_TIMEZONE') || 'UTC',
        // entities: [User, Company, Barang, Role, Menu,KategoriBarang],
        // entities: [User, Company, Barang, Role, Menu,KategoriBarang],
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CompanyModule,
    BarangModule,
    MenuModule,
    KategoriModule,
    CommonModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware) // Gunakan middleware ini
      .forRoutes('*'); // Terapkan ke semua route (atau tentukan route tertentu)
  }
}
