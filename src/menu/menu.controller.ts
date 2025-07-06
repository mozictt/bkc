import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { Menu } from '@entities/menu.entity';

@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  create(@Body() body: Partial<Menu>) {
    return this.menuService.createMenu(body);
  }

  @Get()
  findAll() {
    return this.menuService.getAllMenus();
  }

  @Get('role/:id')
  findAllByRoleId(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getAllMenusByRoleId(id);
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
