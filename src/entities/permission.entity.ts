import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { User } from './user.entity';
import { TenantBaseEntity } from './tenant-base.entity';
import { AccessLevel } from '../permissions/constants/access-level.constant';

@Entity('permissions')
export class Permission extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Role, (role) => role.permissions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role: Relation<Role>;

  @ManyToOne(() => User, (user) => user.permissions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 100 })
  resource: string;

  @Column({
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.VIEW_AKSES,
  })
  accessLevel: AccessLevel;
}
