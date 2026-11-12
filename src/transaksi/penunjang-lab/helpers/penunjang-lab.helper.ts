import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PenunjangLab } from '@entities/penunjang-lab.entity';
import {
  ACTIVE_KUNJUNGAN_STATUSES,
  ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES,
  StatusKunjungan,
} from '@src/transaksi/pendaftaran/constants/pendaftaran.enum';

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_KUNJUNGAN_STATUSES);
const UNPAID_STATUS_SET = new Set<string>(ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES);

/**
 * Mengecek apakah kunjungan pendaftaran masih boleh diinput pemeriksaan/hasil penunjang lab
 * (sedang dalam pemeriksaan/perawatan aktif atau belum lunas dibayar).
 */
export function isPendaftaranEligibleForLab(pendaftaran: {
  statusKunjungan: string;
  statusPembayaran?: string | null;
}): boolean {
  if (pendaftaran.statusKunjungan === StatusKunjungan.BATAL) {
    return false;
  }
  const stillExamined = ACTIVE_STATUS_SET.has(pendaftaran.statusKunjungan);
  const payment = pendaftaran.statusPembayaran || 'BELUM_BAYAR';
  const unpaid = UNPAID_STATUS_SET.has(payment);
  return stillExamined || unpaid;
}

export function assertPendaftaranEligibleForLab(pendaftaran: {
  noRegistrasi: string;
  statusKunjungan: string;
  statusPembayaran?: string | null;
}): void {
  if (pendaftaran.statusKunjungan === StatusKunjungan.BATAL) {
    throw new BadRequestException(
      `Kunjungan ${pendaftaran.noRegistrasi} berstatus BATAL sehingga tidak dapat diinput pemeriksaan lab.`,
    );
  }
  if (!isPendaftaranEligibleForLab(pendaftaran)) {
    throw new BadRequestException(
      `Kunjungan ${pendaftaran.noRegistrasi} sudah selesai dan berstatus pembayaran ${pendaftaran.statusPembayaran}. Penunjang lab hanya dapat diinput untuk pasien yang masih diperiksa atau belum bayar.`,
    );
  }
}

/**
 * Menghasilkan Nomor Lab unik harian secara atomik memakai tabel `tenant_counters`.
 */
export async function generateNoLabAtomic(
  manager: EntityManager,
  tenantId: string,
  dateRef = new Date(),
): Promise<string> {
  const yyyymmdd = dateRef.toISOString().slice(0, 10).replace(/-/g, '');
  const counterKey = `NO_LAB_${yyyymmdd}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rawRows: unknown = await manager.query(
      `INSERT INTO tenant_counters (tenant_id, counter_key, last_value, created_at, updated_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (tenant_id, counter_key)
       DO UPDATE SET last_value = tenant_counters.last_value + 1, updated_at = NOW()
       RETURNING last_value`,
      [tenantId, counterKey],
    );
    const rows = rawRows as Array<{ last_value: string | number }>;
    const seq = Number(rows[0].last_value);
    const candidate = `LAB-${yyyymmdd}-${String(seq).padStart(4, '0')}`;
    const collision = await manager.findOne(PenunjangLab, {
      where: { tenantId, noLab: candidate },
      select: ['id'],
    });
    if (!collision) {
      return candidate;
    }
  }

  throw new ConflictException(
    'Gagal menghasilkan Nomor Laboratorium unik setelah beberapa percobaan.',
  );
}
