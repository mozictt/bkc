import { sanitizePayload } from './sanitize-payload.util';

interface SanitizedPayloadSample {
  nik: string;
  noKk: string;
  no_kk: string;
  noBpjs: string;
  noKartu: string;
  noIdentitasLain: string;
  password: string;
  namaKlinik: string;
  teknikMedis: string;
  nested: {
    nik: string;
    no_bpjs: string;
    spesialisasi: string;
  };
}

describe('sanitizePayload', () => {
  it('menyensor field sensitif kependudukan & asuransi tanpa menyensor field non-sensitif seperti klinik', () => {
    const input = {
      nik: '3273011505900001',
      noKk: '3273011505900099',
      no_kk: '3273011505900088',
      noBpjs: '0001234567890',
      noKartu: 'PRU-9988',
      noIdentitasLain: 'A1234567',
      password: 'secret-password',
      namaKlinik: 'Klinik Utama Sehat',
      teknikMedis: 'Bedah',
      nested: {
        nik: '3273011505900002',
        no_bpjs: '0009876543210',
        spesialisasi: 'Penyakit Dalam',
      },
    };

    const result = sanitizePayload(input) as SanitizedPayloadSample;

    expect(result.nik).toBe('***SENSITIVE***');
    expect(result.noKk).toBe('***SENSITIVE***');
    expect(result.no_kk).toBe('***SENSITIVE***');
    expect(result.noBpjs).toBe('***SENSITIVE***');
    expect(result.noKartu).toBe('***SENSITIVE***');
    expect(result.noIdentitasLain).toBe('***SENSITIVE***');
    expect(result.password).toBe('***SENSITIVE***');
    expect(result.nested.nik).toBe('***SENSITIVE***');
    expect(result.nested.no_bpjs).toBe('***SENSITIVE***');
    expect(result.namaKlinik).toBe('Klinik Utama Sehat');
    expect(result.teknikMedis).toBe('Bedah');
    expect(result.nested.spesialisasi).toBe('Penyakit Dalam');
  });
});
