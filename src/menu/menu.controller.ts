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
import { Menu } from '@entities/menu.entity';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Message } from '@common/decorators/message.decorator';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { CheckPermission } from '@auth/decorators/permissions.decorator';
@UseGuards(PermissionsGuard)
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  create(@Body() body: Partial<Menu>) {
    return this.menuService.createMenu(body);
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
  updatePermission(@Body() body: UpdatePermissionDto) {
    return this.menuService.updateRoleMenuPermission(body);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getMenuById(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<Menu>) {
    return this.menuService.updateMenu(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.deleteMenu(id);
  }
}
