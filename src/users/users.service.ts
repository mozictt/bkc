// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // async findByUsername(username: string) {
  //   return this.userRepo.findOne({ where: { username } });
  // }
  findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      relations: ['role', 'role.menus'], // ⬅️ ini penting!
    });
  }

  async findById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  async updateRefreshToken(userId: number, token: string) {
    await this.userRepo.update(userId, { refreshToken: token });
  }

  async create(username: string, passwordHash: string,id_role: number) { 
    const user = this.userRepo.create(
      { 
        username, 
        password: passwordHash,
         role: { id: id_role }
      });
    return this.userRepo.save(user);
  }
}
