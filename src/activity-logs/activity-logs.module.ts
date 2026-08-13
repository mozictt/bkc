import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';
import { CommonModule } from '../common/common.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog]),
    CommonModule,
    PermissionsModule,
  ],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService, ActivityLogInterceptor],
  exports: [ActivityLogsService, ActivityLogInterceptor],
})
export class ActivityLogsModule {}
