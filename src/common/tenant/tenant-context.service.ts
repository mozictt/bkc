import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<Map<string, any>>();

  run(tenantId: string | null, role: string | null, callback: () => void) {
    const store = new Map();
    store.set('tenantId', tenantId); 
    store.set('role', role);
    TenantContextService.storage.run(store, callback);
  }

  getTenantId(): string | undefined {
    const store = TenantContextService.storage.getStore();
    const tenantId = store?.get('tenantId');
    // console.log("kene");
    // Jika tenantId adalah number (dari DB/JWT), konversi ke string agar konsisten
    return tenantId !== undefined && tenantId !== null 
      ? String(tenantId) 
      : undefined;
  }

  getRole(): string | undefined {
    const store = TenantContextService.storage.getStore();
    return store?.get('role');
  }
}