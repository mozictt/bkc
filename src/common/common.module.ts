import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant/tenant-context.service';
// import { TenantInterceptor } from './tenant.interceptor';
import { TenantSubscriber } from './tenant/tenant.subscriber'; // Import subscriber

@Global()
@Module({
  providers: [
    TenantContextService, 
    // TenantInterceptor,
    TenantSubscriber, // Tambahkan di sini agar otomatis aktif
  ],
  exports: [
    TenantContextService, 
    // TenantInterceptor,
    // TenantSubscriber tidak wajib di export karena dia bekerja di background TypeORM
  ],
})
export class CommonModule {}