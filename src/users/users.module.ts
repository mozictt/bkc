import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Pegawai } from '../entities/pegawai.entity';
import { Tenant } from '../entities/tenant.entity';
import { Role } from '../role/entities/role.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Pegawai, Tenant, Role])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
