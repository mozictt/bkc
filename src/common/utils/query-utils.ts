// src/common/utils/query-utils.ts

export function tenantLeftJoin<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  property: string,
  alias: string,
  tenantId?: string | null, // Sekarang opsional
): SelectQueryBuilder<T> {
  // Jika tidak ada tenantId, lakukan join standar tanpa kondisi tambahan
  if (!tenantId) {
    return query.leftJoinAndSelect(property, alias);
  }

  return query.leftJoinAndSelect(
    property,
    alias,
    `${alias}.tenant_id = :tenantId`,
    { tenantId },
  );
}

export function tenantInnerJoin<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  property: string,
  alias: string,
  tenantId?: string | null,
): SelectQueryBuilder<T> {
  if (!tenantId) {
    return query.innerJoinAndSelect(property, alias);
  }

  return query.innerJoinAndSelect(
    property,
    alias,
    `${alias}.tenant_id = :tenantId`,
    { tenantId },
  );
}
