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
import { RedisModule } from '@nestjs-modules/ioredis';
import { RoleModule } from './role/role.module';
import { GalleryModule } from './gallery/gallery.module';
import { PermissionsModule } from './permissions/permissions.module';
import { TenantsModule } from './tenants/tenants.module';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { ActivityLogInterceptor } from './activity-logs/interceptors/activity-log.interceptor';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') || 'localhost';
        const port = config.get<number>('REDIS_PORT') || 6379;
        return {
          type: 'single',
          url: `redis://${host}:${port}`,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'localhost',
        port: parseInt(config.get<string>('DB_PORT') || '5432', 10),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        timezone: config.get<string>('APP_TIMEZONE') || 'UTC',
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
    RoleModule,
    GalleryModule,
    PermissionsModule,
    TenantsModule,
    ActivityLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
