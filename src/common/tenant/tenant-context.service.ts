import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<Map<string, any>>();

  run(
    tenantId: string | null,
    slug: string | null,
    role: string | null,
    callback: () => void,
  ) {
    const store = new Map();
    store.set('tenantId', tenantId);
    store.set('slug', slug);
    store.set('role', role);
    TenantContextService.storage.run(store, callback);
  }

  getTenantId(): string | undefined {
    const store = TenantContextService.storage.getStore();
    const tenantId = store?.get('tenantId');  
    return tenantId !== undefined && tenantId !== null
      ? String(tenantId)
      : undefined;
  }
  getSlug(): string | undefined {
    const store = TenantContextService.storage.getStore();
    const slug = store?.get('slug');

    return slug !== undefined && slug !== null ? String(slug) : undefined;
  }
  getRole(): string | undefined {
    const store = TenantContextService.storage.getStore(); 
    return store?.get('role');
  }
}
