import { JenisUnit } from '@src/master-simrs/constants/simrs.enum';

export enum JenisLayananPendaftaran {
  RAWAT_JALAN = 'RAWAT_JALAN',
  RAWAT_INAP = 'RAWAT_INAP',
  IGD = 'IGD',
  INTENSIVE = 'INTENSIVE',
}

export enum StatusKunjungan {
  TERDAFTAR = 'TERDAFTAR',
  DALAM_PELAYANAN = 'DALAM_PELAYANAN',
  DIRAWAT = 'DIRAWAT',
  SELESAI = 'SELESAI',
  BATAL = 'BATAL',
}

export enum StatusPembayaranKunjungan {
  BELUM_BAYAR = 'BELUM_BAYAR',
  SEBAGIAN = 'SEBAGIAN',
  LUNAS = 'LUNAS',
  DITANGGUNG_PENJAMIN = 'DITANGGUNG_PENJAMIN',
}

export const ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES: readonly StatusPembayaranKunjungan[] =
  [
    StatusPembayaranKunjungan.BELUM_BAYAR,
    StatusPembayaranKunjungan.SEBAGIAN,
  ];

export enum StatusPenempatanUnit {
  AKTIF = 'AKTIF',
  SELESAI = 'SELESAI',
  BATAL = 'BATAL',
}

export enum JenisPerpindahanUnit {
  PENDAFTARAN_AWAL = 'PENDAFTARAN_AWAL',
  MUTASI_RAJAL = 'MUTASI_RAJAL',
  ADMISI_RANAP = 'ADMISI_RANAP',
  MUTASI_RANAP = 'MUTASI_RANAP',
  PINDAH_BED = 'PINDAH_BED',
  GANTI_DPJP = 'GANTI_DPJP',
  BATAL_RANAP = 'BATAL_RANAP',
}

export enum CaraMasukPasien {
  DATANG_SENDIRI = 'DATANG_SENDIRI',
  RUJUKAN_FKTP = 'RUJUKAN_FKTP',
  RUJUKAN_RS_LAIN = 'RUJUKAN_RS_LAIN',
  IGD = 'IGD',
  KONTROL = 'KONTROL',
  LAINNYA = 'LAINNYA',
}

export enum CaraKeluarPasien {
  PULANG_SEMBUH = 'PULANG_SEMBUH',
  PULANG_PAKSA = 'PULANG_PAKSA',
  DIRUJUK = 'DIRUJUK',
  MENINGGAL = 'MENINGGAL',
  LAINNYA = 'LAINNYA',
}

export const ACTIVE_KUNJUNGAN_STATUSES: readonly StatusKunjungan[] = [
  StatusKunjungan.TERDAFTAR,
  StatusKunjungan.DALAM_PELAYANAN,
  StatusKunjungan.DIRAWAT,
];

export const INPATIENT_LAYANAN_SET = new Set<string>([
  JenisLayananPendaftaran.RAWAT_INAP,
  JenisLayananPendaftaran.INTENSIVE,
]);

export const UNIT_JENIS_TO_LAYANAN_MAP: Partial<
  Record<JenisUnit, JenisLayananPendaftaran>
> = {
  [JenisUnit.RAWAT_JALAN]: JenisLayananPendaftaran.RAWAT_JALAN,
  [JenisUnit.RAWAT_INAP]: JenisLayananPendaftaran.RAWAT_INAP,
  [JenisUnit.IGD]: JenisLayananPendaftaran.IGD,
  [JenisUnit.INTENSIVE]: JenisLayananPendaftaran.INTENSIVE,
};

