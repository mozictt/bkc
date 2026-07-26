import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from '@entities/menu.entity';

@Injectable()
export class PermissionSeederService implements OnModuleInit {
  private readonly logger = new Logger(PermissionSeederService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
  ) {}

  async onModuleInit() {
    this.logger.log('Memulai proses Automatic Resource Discovery...');
    
    // Ambil semua controller yang terdaftar di aplikasi
    const controllers = this.discoveryService.getControllers();
    
    const detectedMenus = new Set<string>();

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;

      // Ambil method-method dari prototype controller
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (methodName) => methodName !== 'constructor'
      );

      for (const methodName of methodNames) {
        const method = prototype[methodName];
        
        // Baca metadata 'permission' dari dekorator @CheckPermission
        const permissionMeta = this.reflector.get<{
          action: string | string[];
          menu: string;
        }>('permission', method);

        if (permissionMeta && permissionMeta.menu) {
          detectedMenus.add(permissionMeta.menu);
        }
      }
    }

    // Upsert menu yang terdeteksi ke Database
    let addedCount = 0;
    for (const menuName of detectedMenus) {
      const exists = await this.menuRepo.findOne({ where: { name: menuName } });
      
      if (!exists) {
        // Buat menu baru dengan is_visible = false agar tidak mengotori UI Sidebar
        const newMenu = this.menuRepo.create({
          name: menuName,
          url: `/api/auto-discovered/${menuName.toLowerCase().replace(/\s+/g, '-')}`,
          is_visible: false, // 🔥 Sembunyikan dari Sidebar UI
          is_active: true,
          order_no: 999, // Taruh di urutan paling bawah
        });
        
        await this.menuRepo.save(newMenu);
        addedCount++;
        this.logger.log(`[Auto-Discovery] Resource baru ditambahkan: ${menuName}`);
      }
    }

    this.logger.log(`Selesai sinkronisasi Resource Permissions. Total resource baru: ${addedCount}`);
  }
}
