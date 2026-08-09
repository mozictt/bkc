// src/permissions/constants/access-level.constant.ts

// 1. Definisikan aksi-aksi dasarnya (Primitive Actions)
export type PrimitiveAction = 'manage' | 'view' | 'create' | 'update' | 'delete';

// 2. Definisikan Level Akses
export enum AccessLevel {
  FULL_AKSES = 'full-akses',
  ADMIN_AKSES = 'admin-akses',
  CHANGE_AKSES = 'change-akses',
  VIEW_AKSES = 'view-akses',
}

// 3. Mapping: Hubungkan Level Akses dengan Aksi Dasarnya (Bundle)
export const AccessLevelMapping: Record<AccessLevel, PrimitiveAction[]> = {
  [AccessLevel.FULL_AKSES]: ['manage', 'view', 'create', 'update', 'delete'],
  [AccessLevel.ADMIN_AKSES]: ['view', 'create', 'update', 'delete'],
  [AccessLevel.CHANGE_AKSES]: ['view', 'create', 'update'],
  [AccessLevel.VIEW_AKSES]: ['view'],
};
