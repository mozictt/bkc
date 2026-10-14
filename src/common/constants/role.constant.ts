/**
 * Konstanta role sistem terpusat untuk menghindari hardcode string di berbagai tempat.
 */
export const ROLE_SUPER_ADMIN = 'Super Admin';

/**
 * Helper deklaratif untuk mengecek apakah sebuah nama role adalah Super Admin.
 * Case-insensitive dan aman terhadap spasi / nilai null/undefined.
 */
export function isSuperAdminRole(roleName?: string | null): boolean {
  if (!roleName) return false;
  return String(roleName).trim().toLowerCase() === ROLE_SUPER_ADMIN.toLowerCase();
}
