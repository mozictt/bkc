export enum JenisKelamin {
  LAKI_LAKI = 'L',
  PEREMPUAN = 'P',
}

export enum JenisIdentitas {
  KTP = 'KTP',
  PASPOR = 'PASPOR',
  KITAS = 'KITAS',
  KITAP = 'KITAP',
  KIA = 'KIA',
  TANPA_IDENTITAS = 'TANPA_IDENTITAS',
}

export enum StatusHidup {
  HIDUP = 'HIDUP',
  MENINGGAL = 'MENINGGAL',
}

export enum GolonganDarah {
  A = 'A',
  B = 'B',
  AB = 'AB',
  O = 'O',
  TIDAK_TAHU = 'TIDAK_TAHU',
}

export enum RhesusDarah {
  POSITIF = '+',
  NEGATIF = '-',
}

export enum StatusPerkawinan {
  BELUM_KAWIN = 'BELUM_KAWIN',
  KAWIN = 'KAWIN',
  CERAI_HIDUP = 'CERAI_HIDUP',
  CERAI_MATI = 'CERAI_MATI',
}

export enum Kewarganegaraan {
  WNI = 'WNI',
  WNA = 'WNA',
}

export enum StatusKepegawaian {
  PNS = 'PNS',
  PPPK = 'PPPK',
  TETAP_RS = 'TETAP_RS',
  KONTRAK = 'KONTRAK',
  MITRA = 'MITRA',
  HONORER = 'HONORER',
  RESIDEN = 'RESIDEN',
}

export enum StatusAktifPegawai {
  AKTIF = 'AKTIF',
  CUTI = 'CUTI',
  NONAKTIF = 'NONAKTIF',
  PENSIUN = 'PENSIUN',
  RESIGN = 'RESIGN',
}

export enum JenisDokter {
  UMUM = 'UMUM',
  SPESIALIS = 'SPESIALIS',
  SUBSPESIALIS = 'SUBSPESIALIS',
  GIGI = 'GIGI',
  GIGI_SPESIALIS = 'GIGI_SPESIALIS',
}

export enum JenisPenjamin {
  UMUM = 'UMUM',
  BPJS = 'BPJS',
  ASURANSI_SWASTA = 'ASURANSI_SWASTA',
  PERUSAHAAN = 'PERUSAHAAN',
  KEMENKES = 'KEMENKES',
  LAINNYA = 'LAINNYA',
}

export enum HubunganPenanggungJawab {
  DIRI_SENDIRI = 'DIRI_SENDIRI',
  PASANGAN = 'PASANGAN',
  ORANG_TUA = 'ORANG_TUA',
  ANAK = 'ANAK',
  SAUDARA = 'SAUDARA',
  KERABAT = 'KERABAT',
  LAINNYA = 'LAINNYA',
}

export enum FormatNoRm {
  PLAIN_8 = 'PLAIN_8',
  DASH_6 = 'DASH_6',
}

export enum StatusAktifMaster {
  AKTIF = 'Y',
  NONAKTIF = 'N',
}
