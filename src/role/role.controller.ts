import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsDto } from './dto/add-permission-role.dto';
import { ResponseMessage } from '@common/decorators/message.decorator';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  /**
   * Endpoint untuk menambah permissions (role_id dikirim via JSON)
   * POST /roles/permissions
   */
  @Post('permissions')
  @ResponseMessage('Permissions berhasil diperbarui')
  async addPermissions(@Body() dto: AddPermissionsDto) {
    // Kita passing seluruh dto ke service
    return await this.roleService.addPermissions(dto);
  }

  @Get()
  findAll() {
    return this.roleService.findAll();
  }

  @Get('menu')
  findAllMenu() {
    return this.roleService.findAllMenu();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
