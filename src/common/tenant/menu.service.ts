import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const tenantId = this.tenantContext.getTenantId(); 
    const queryOptions: any = {
      where: {},
    };

    if (tenantId) {
      queryOptions.where.tenantId = tenantId;
    }

    return this.menuRepository.find(queryOptions);
  }
}