import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsDto } from './dto/add-permission-role.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Role } from './entities/role.entity';
import { Menu } from '@entities/menu.entity';
import { Permission } from '@entities/permission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly tenantService: TenantContextService,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  private getTenantId(): string {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) {
      throw new ConflictException('Tenant context tidak ditemukan.');
    }
    return tenantId;
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const tenantId = this.getTenantId();

    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name, tenantId },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role dengan nama "${createRoleDto.name}" sudah terdaftar.`,
      );
    }

    const { permissions, ...roleData } = createRoleDto;

    const newRole = this.roleRepository.create({
      ...roleData,
      tenantId,
      permissions: permissions?.map((p) => ({
        tenantId,
        resource: p.resource,
        accessLevel: p.accessLevel,
      })),
    });

    return await this.roleRepository.save(newRole);
  }

  async addPermissions(dto: AddPermissionsDto): Promise<Role> {
    const tenantId = this.getTenantId();
    const { role_id, permissions } = dto;
    try {
      const role = await this.roleRepository.findOne({
        where: { id: role_id, tenantId },
        relations: ['permissions'],
      });

      if (!role) {
        throw new NotFoundException(
          `Role dengan ID "${role_id}" tidak ditemukan.`,
        );
      } 
      
      const currentPermissions = role.permissions || [];
      const existingResources = currentPermissions.map((p) => p.resource); 

      const uniqueNewPermissionsDto = permissions.filter(
        (p) => !existingResources.includes(p.resource),
      );

      if (uniqueNewPermissionsDto.length === 0) {
        return role;
      }

      const newPermissions = uniqueNewPermissionsDto.map((p) => {
        const perm = new Permission();
        perm.tenantId = tenantId;
        perm.resource = p.resource;
        perm.accessLevel = p.accessLevel;
        return perm;
      });

      role.permissions = [...currentPermissions, ...newPermissions];

      return await this.roleRepository.save(role);
    } catch (error) {
      console.error('ERROR ASLI DATABASE:', error);
      throw error;
    }
  }

  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType: 'ASC' | 'DESC' = 'DESC',
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const tenantId = this.getTenantId();

    const queryBuilder = this.roleRepository.createQueryBuilder('role');
    queryBuilder.where('role.tenantId = :tenantId', { tenantId });

    if (search) {
      queryBuilder.andWhere('LOWER(role.name) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    const allowedSortFields = ['id', 'name', 'createdAt'];
    const orderColumn = allowedSortFields.includes(sortBy) ? sortBy : 'id';
    const orderDirection = ['ASC', 'DESC'].includes(sortType.toUpperCase())
      ? (sortType.toUpperCase() as 'ASC' | 'DESC')
      : 'DESC';

    const [data, total] = await queryBuilder
      .orderBy(`role.${orderColumn}`, orderDirection)
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      success: true,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        currentPage: safePage,
      },
      data: data,
    };
  }

  // Sebaiknya dipanggil dari MenuService, namun jika butuh di RoleService:
  async findAllMenu() {
    const tenantId = this.getTenantId();
    const role_id = this.tenantService.getRole();
    
    // We rewrite this logic to match the new permission structure
    const queryBuilder = this.menuRepository.createQueryBuilder('m');
    queryBuilder
      .leftJoin('permissions', 'p', 'p.resource = m.required_resource')
      .leftJoin('roles', 'r', 'r.id = p.role_id');
      
    queryBuilder.select([
      'm.name AS name',
      'm.icon AS icon',
      'm.url AS url',
      'm.is_active AS is_active',
      'm.parent_id AS parent_id',
      'p.id AS id_role_permission',
      'm.parent',
    ]);
    queryBuilder.where('m.tenantId = :tenantId', { tenantId });
    queryBuilder.andWhere('r.id = :roleId', { roleId: role_id });
    
    const total = await queryBuilder.getCount();
    const data = await queryBuilder.getRawMany();

    return {
      success: true,
      meta: {
        totalItems: total,
      },
      data: data,
    };
  }

  async findOne(id: number): Promise<Role> {
    const tenantId = this.getTenantId();

    const role = await this.roleRepository.findOne({
      where: { id, tenantId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role dengan ID #${id} tidak ditemukan.`);
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const tenantId = this.getTenantId();

    const role = await this.findOne(id);
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: updateRoleDto.name, tenantId },
      });
      if (existingRole) {
        throw new ConflictException(
          `Role dengan nama "${updateRoleDto.name}" sudah digunakan.`,
        );
      }
    }

    const updatedRole = this.roleRepository.merge(role, updateRoleDto);

    return await this.roleRepository.save(updatedRole);
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const role = await this.findOne(id);

    await this.roleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        await transactionalEntityManager.softDelete(Permission, {
          role: { id: role.id },
          tenantId: role.tenantId, 
        });

        await transactionalEntityManager.softDelete(Role, id);
      },
    );

    return {
      success: true,
      message: `Role dengan ID #${id} beserta seluruh permissions-nya berhasil dihapus.`,
    };
  }
}
