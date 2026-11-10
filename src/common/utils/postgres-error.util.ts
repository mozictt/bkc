/**
 * Mengambil kode error PostgreSQL (misal '23505', '23503') secara type-safe dari object error unknown.
 */
export function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

