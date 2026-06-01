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

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly tenantService: TenantContextService,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  /**
   * Mendapatkan Tenant ID dari context yang aktif
   */
  private getTenantId(): string {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) {
      throw new ConflictException('Tenant context tidak ditemukan.');
    }
    return tenantId;
  }

  /**
   * Membuat role baru beserta permissions-nya (Cascade)
   */
  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const tenantId = this.getTenantId();

    // 1. Cek duplikasi nama role pada tenant yang sama
    const existingRole = await this.roleRepository.findOne({
      where: { name: createRoleDto.name, tenantId },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role dengan nama "${createRoleDto.name}" sudah terdaftar.`,
      );
    }

    // 2. Mapping DTO ke Struktur Entity (Termasuk merelasikan tenantId ke objek permission jika diperlukan)
    const { permissions, ...roleData } = createRoleDto;

    const newRole = this.roleRepository.create({
      ...roleData,
      tenantId,
      // Jika permissions diisi, kita map ke entity target memanfaatkan cascade insert
      permissions: permissions?.map((p) => ({
        tenantId,
        actions: p.actions,

        // ✅ CARA BENAR: Petakan ke objek 'menu' sesuai nama property di Entity RoleMenuPermission
        menu: { id: p.menu_id } as Menu,
      })),
    });

    return await this.roleRepository.save(newRole);
  }

  /**
   * Menambahkan permissions baru dengan filter duplikasi menu_id (role_id via JSON)
   */
  async addPermissions(dto: AddPermissionsDto): Promise<Role> {
    const tenantId = this.getTenantId();
    const { role_id, permissions } = dto;
    try {
      // 1. Cari role berdasarkan role_id dari JSON body
      const role = await this.roleRepository.findOne({
        where: { id: role_id, tenantId },
        relations: ['permissions', 'permissions.menu'],
      });
      // return false;

      if (!role) {
        throw new NotFoundException(
          `Role dengan ID "${role_id}" tidak ditemukan.`,
        );
      } 
      // 2. Ambil daftar menu_id yang sudah dimiliki oleh role ini
      const existingMenuIds = role.permissions.map((p) => p.menu.id); 


      // 3. Filter: Hanya ambil menu_id yang BELUM ada di database
      const uniqueNewPermissionsDto = permissions.filter(
        (p) => !existingMenuIds.includes(p.menu_id),
      );

      
      // 4. Jika tidak ada menu baru yang lolos filter, langsung kembalikan data role yang ada
      if (uniqueNewPermissionsDto.length === 0) {
        return role;
      }

      // 5. Mapping data baru ke format Entity
      const newPermissions = uniqueNewPermissionsDto.map((p) => ({
        tenantId,
        actions: p.actions,
        menu: { id: p.menu_id } as Menu,
      }));

      // console.log(newPermissions);

      // 6. Gabungkan dan Simpan ke Database
      role.permissions = [...role.permissions, ...newPermissions];
      // console.log(role.permissions);
      // return false;

      return await this.roleRepository.save(role);
    } catch (error) {
      console.log('ERROR ASLI DATABASE:', error.message); // Ini akan memunculkan error detail di terminal Anda
      throw error;
    }
  }

  /**
   * Mengambil semua data role dengan Pagination, Filter, dan Sorting (Multitenant)
   */
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
      // Menggunakan LOWER untuk case-insensitive search
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

  /**
   * Mengambil semua data menu dengan Relasi Role Permission, Pagination, Filter, dan Sorting (Multitenant)
   */
  async findAllMenu() {
    const tenantId = this.getTenantId();
    const role_id = this.tenantService.getRole();
    const queryBuilder = this.menuRepository.createQueryBuilder('m');
    queryBuilder
      .leftJoin('role_menu_permissions', 'rmp', 'rmp.menu_id = m.id')
      .leftJoin('roles', 'r', 'r.id = rmp.role_id');
    queryBuilder.select([
      'm.name AS name',
      'm.icon AS icon',
      'm.url AS url',
      'm.is_active AS is_active',
      'm.parent_id AS parent_id',
      'rmp.id AS id_role_permission',
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

  /**
   * Mencari satu role berdasarkan ID beserta dataload permissions-nya
   */
  async findOne(id: number): Promise<Role> {
    const tenantId = this.getTenantId();

    const role = await this.roleRepository.findOne({
      where: { id, tenantId },
      relations: ['permissions'], // Load relasi agar data permissions ikut tampil
    });

    if (!role) {
      throw new NotFoundException(`Role dengan ID #${id} tidak ditemukan.`);
    }

    return role;
  }

  /**
   * Memperbarui data role (Hanya yang memiliki Tenant ID yang sesuai)
   */
  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const tenantId = this.getTenantId();

    // Pastikan data ada dan milik tenant tersebut sebelum di-update
    const role = await this.findOne(id);
    // Jika ingin mengganti nama, cek dulu apakah nama barunya duplikat di tenant yang sama
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

    // Lakukan merge data DTO ke entitas yang sudah ada
    const updatedRole = this.roleRepository.merge(role, updateRoleDto);

    return await this.roleRepository.save(updatedRole);
  }

  /**
   * Menghapus data role (Hanya yang memiliki Tenant ID yang sesuai)
   */
  async remove(id: number): Promise<{ success: boolean; message: string }> {
    // 1. Pastikan data ada dan milik tenant tersebut sebelum di-delete
    const role = await this.findOne(id);

    // 2. Gunakan Transaction agar jika salah satu gagal, semuanya di-rollback
    await this.roleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // Anggap saja nama entity permission kamu adalah 'RoleMenuPermission'
        // Kita soft delete semua permission yang memiliki roleId ini
        await transactionalEntityManager.softDelete('RoleMenuPermission', {
          role: { id: role.id },
          tenantId: role.tenantId, // Tambahkan tenantId demi keamanan multitenant
        });

        // 3. Setelah permissions berhasil di-soft-delete, baru soft-delete role-nya
        await transactionalEntityManager.softDelete(Role, id);
      },
    );

    return {
      success: true,
      message: `Role dengan ID #${id} beserta seluruh permissions-nya berhasil dihapus.`,
    };
  }
}
