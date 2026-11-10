import { sanitizePayload } from './sanitize-payload.util';

interface SanitizedPayloadSample {
  nik: string;
  noKk: string;
  no_kk: string;
  password: string;
  namaKlinik: string;
  teknikMedis: string;
  nested: {
    nik: string;
    spesialisasi: string;
  };
}

describe('sanitizePayload', () => {
  it('menyensor field sensitif password, token, nik, dan noKk tanpa menyensor field non-sensitif seperti klinik', () => {
    const input = {
      nik: '3273011505900001',
      noKk: '3273011505900099',
      no_kk: '3273011505900088',
      password: 'secret-password',
      namaKlinik: 'Klinik Utama Sehat',
      teknikMedis: 'Bedah',
      nested: {
        nik: '3273011505900002',
        spesialisasi: 'Penyakit Dalam',
      },
    };

    const result = sanitizePayload(input) as SanitizedPayloadSample;

    expect(result.nik).toBe('***SENSITIVE***');
    expect(result.noKk).toBe('***SENSITIVE***');
    expect(result.no_kk).toBe('***SENSITIVE***');
    expect(result.password).toBe('***SENSITIVE***');
    expect(result.nested.nik).toBe('***SENSITIVE***');
    expect(result.namaKlinik).toBe('Klinik Utama Sehat');
    expect(result.teknikMedis).toBe('Bedah');
    expect(result.nested.spesialisasi).toBe('Penyakit Dalam');
  });
});
