import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @RequirePermission('Menu', 'create')
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.createMenu(dto);
  }

  @Get()
  @RequirePermission('Menu', 'view')
  findAll() {
    return this.menuService.getAllMenus();
  }

  @Get('role/:id')
  findAllByRoleId(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getAllMenusByRoleId(id);
  }

  @Put('permissions')
  @RequirePermission('Menu', 'update') // You could also define a specific resource like RoleMenuPermission if needed
  updatePermission(@Body() dto: UpdatePermissionDto) {
    return this.menuService.updateRoleMenuPermission(dto);
  }

  @Get(':id')
  @RequirePermission('Menu', 'view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getMenuById(id);
  }

  @Put(':id')
  @RequirePermission('Menu', 'update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menuService.updateMenu(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Menu', 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.deleteMenu(id);
  }
}
