// src/common/tenant/tenant.subscriber.ts
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { TenantContextService } from './tenant-context.service';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {
    // Daftarkan subscriber ke koneksi database
    this.dataSource.subscribers.push(this);
  }

  // Dipanggil tepat sebelum data di-INSERT
  beforeInsert(event: InsertEvent<any>) {
    this.injectTenantId(event);
  }

  // Dipanggil tepat sebelum data di-UPDATE
  beforeUpdate(event: UpdateEvent<any>) {
    this.injectTenantId(event);
  }

  private injectTenantId(event: InsertEvent<any> | UpdateEvent<any>) {
    const entity = event.entity;
    const tenantId = this.tenantContext.getTenantId();
    const role = this.tenantContext.getRole();

    // Jika Super Admin, jangan paksa inject tenantId dari context
    if (role === 'Super Admin') {
      return;
    }

    // Cek apakah entitas ini memiliki kolom bernama 'tenantId' berdasarkan metadata TypeORM
    const hasTenantIdColumn = event.metadata.columns.some(
      (column) => column.propertyName === 'tenantId',
    );

    if (entity && hasTenantIdColumn && tenantId) {
      // Inject tenantId secara otomatis
      entity.tenantId = tenantId;
      console.log(`[TenantSubscriber] Injected tenantId: ${tenantId} into ${event.metadata.targetName}`);
    } else if (!tenantId) {
      console.warn(`[TenantSubscriber] Warning: No tenantId found in context!`);
    }
  }
}
