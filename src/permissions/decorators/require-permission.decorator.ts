import { SetMetadata } from '@nestjs/common';
import { PrimitiveAction } from '../constants/access-level.constant';

export const PERMISSION_KEY = 'require_permission';

export const RequirePermission = (resource: string, action: PrimitiveAction) =>
  SetMetadata(PERMISSION_KEY, { resource, action });
