import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  FindOptionsWhere,
  IsNull,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Memformat nama lengkap dokter beserta gelar depan dan gelar belakang.
 */
export function formatNamaGelarDokter(
  gelarDepan?: string | null,
  namaLengkap?: string | null,
  gelarBelakang?: string | null,
): string {
  const namaUtama = [gelarDepan?.trim(), namaLengkap?.trim()]
    .filter(Boolean)
    .join(' ');
  if (!namaUtama) return '';
  return gelarBelakang?.trim()
    ? `${namaUtama}, ${gelarBelakang.trim()}`
    : namaUtama;
}

/**
 * Memastikan sekumpulan field unik (seperti kode, nama) belum dipakai pada tenant yang sama.
 */
export async function assertUniqueTenantFields<
  T extends ObjectLiteral & { id: number; tenantId: string | null },
>(
  repo: Repository<T>,
  tenantId: string,
  checks: Array<{ field: keyof T & string; value: string; label: string }>,
  excludeId?: number,
): Promise<void> {
  const idFilter = excludeId ? { id: Not(excludeId) } : {};
  const results = await Promise.all(
    checks.map((check) =>
      repo.findOne({
        where: {
          [check.field]: check.value,
          tenantId,
          ...idFilter,
        } as FindOptionsWhere<T>,
        select: ['id'] as Array<keyof T & string>,
      }),
    ),
  );

  results.forEach((found, idx) => {
    if (found) {
      throw new ConflictException(
        `${checks[idx].label} "${checks[idx].value}" sudah digunakan.`,
      );
    }
  });
}

/**
 * Menyimpan entitas dengan penanganan pelanggaran unique constraint PostgreSQL (23505).
 */
export async function saveWithUniqueHandling<T extends ObjectLiteral>(
  repo: Repository<T>,
  entity: T,
  conflictMessage: string,
): Promise<T> {
  try {
    return await repo.save(entity);
  } catch (error: unknown) {
    if (getPostgresErrorCode(error) === '23505') {
      throw new ConflictException(conflictMessage);
    }
    throw error;
  }
}

/**
 * Hard-remove entitas dengan penanganan foreign key constraint PostgreSQL (23503).
 */
export async function removeWithFkHandling<T extends ObjectLiteral>(
  repo: Repository<T>,
  entity: T,
  fkConflictMessage: string,
): Promise<void> {
  try {
    await repo.remove(entity);
  } catch (error: unknown) {
    if (getPostgresErrorCode(error) === '23503') {
      throw new ConflictException(fkConflictMessage);
    }
    throw error;
  }
}

/**
 * Memastikan referensi data master milik tenant aktif (atau hasil seeder global tenantId IS NULL) tersedia dan aktif.
 */
export async function assertActiveMasterRecord<
  T extends ObjectLiteral & {
    id: number;
    tenantId: string | null;
    status: string;
  },
>(
  repo: Repository<T>,
  id: number,
  tenantId: string,
  label: string,
  allowGlobalSeed = true,
): Promise<T> {
  const where = allowGlobalSeed
    ? [
        { id, tenantId },
        { id, tenantId: IsNull() },
      ]
    : { id, tenantId };

  const record = await repo.findOne({ where: where as never });
  if (!record) {
    throw new BadRequestException(`${label} dengan ID #${id} tidak ditemukan.`);
  }
  if (record.status !== 'Y') {
    throw new BadRequestException(`${label} dengan ID #${id} sedang nonaktif.`);
  }
  return record;
}
