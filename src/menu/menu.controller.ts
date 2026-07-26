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
import { ResponseMessage } from '@common/decorators/message.decorator';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { CheckPermission } from '@auth/decorators/permissions.decorator';

@UseGuards(PermissionsGuard)
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) { }

  @Post()
  @CheckPermission(['manage', 'create'], 'Menu')
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.createMenu(dto);
  }

  @Get()
  @CheckPermission(['manage', 'view'], 'Menu')
  findAll() {
    return this.menuService.getAllMenus();
  }

  @Get('role/:id')
  findAllByRoleId(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getAllMenusByRoleId(id);
  }

  @Put('permissions')
  // @CheckPermission(['manage', 'update'], 'RoleMenuPermission')
  updatePermission(@Body() dto: UpdatePermissionDto) {
    return this.menuService.updateRoleMenuPermission(dto);
  }

  @Get(':id')
  @CheckPermission(['manage', 'view'], 'Menu')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getMenuById(id);
  }

  @Put(':id')
  @CheckPermission(['manage', 'update'], 'Menu')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menuService.updateMenu(id, dto);
  }

  @Delete(':id')
  @CheckPermission(['manage', 'delete'], 'Menu')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.deleteMenu(id);
  }
}
