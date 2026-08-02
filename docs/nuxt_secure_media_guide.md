# Panduan Integrasi Frontend (Nuxt.js) untuk Galeri Aman

Karena API media saat ini dilindungi secara global oleh `JwtAuthGuard`, file media (gambar/video) tidak bisa langsung dipanggil menggunakan tag HTML biasa seperti `<img src="...">`. Browser tidak mengirimkan token otorisasi secara otomatis untuk tag aset.

Berikut adalah panduan dan potongan kode yang dapat Anda gunakan nanti di proyek Nuxt.js Anda.

## Konsep Dasar (Object URL)
1. Frontend menggunakan *API Client* (seperti `$fetch` atau Axios) untuk mengambil data media dari NestJS.
2. Saat mengambil, selipkan *Header* `Authorization: Bearer <TOKEN>`.
3. Paksa respon bertipe `blob` (Binary Large Object).
4. Ubah Blob tersebut menjadi URL sementara di sisi klien menggunakan `URL.createObjectURL()`.
5. Pasang URL sementara tersebut ke atribut `src` pada tag `<img>` atau `<video>`.

## Contoh Implementasi Komponen Vue / Nuxt 3

```vue
<template>
  <div class="gallery-item">
    <!-- Tampilan saat gambar masih diambil dari server -->
    <div v-if="isLoading" class="loading-placeholder">
      Memuat media aman...
    </div>
    
    <!-- Render jika URL Blob sudah siap -->
    <img 
      v-else-if="secureImageUrl" 
      :src="secureImageUrl" 
      alt="Dokumentasi Galeri" 
      class="secured-image"
    />
    
    <div v-else class="error-placeholder">
      Gagal memuat media (Cek otorisasi)
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
// Anda bisa menggunakan composable milik Anda, contoh: const auth = useAuth()

// Props jika komponen ini merupakan komponen re-usable
const props = defineProps({
  filename: {
    type: String,
    required: true
  }
});

const secureImageUrl = ref<string | null>(null);
const isLoading = ref(true);

const loadSecureMedia = async () => {
  try {
    // 1. Dapatkan Token JWT aktif Anda (sesuaikan dengan arsitektur store Anda)
    const token = 'BEARER_TOKEN_ANDA_DI_SINI'; 
    
    // 2. Fetch data sebagai Blob
    const response = await $fetch(`http://localhost:3000/gallery/media/${props.filename}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      responseType: 'blob' // 🌟 PENTING: Response harus berbentuk binary blob
    });

    // 3. Buat URL lokal sementara (berawalan blob:http://...)
    secureImageUrl.value = URL.createObjectURL(response as Blob);
  } catch (error) {
    console.error('Gagal memuat atau tidak memiliki akses:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadSecureMedia();
});

// 🌟 BEST PRACTICE: Mencegah Memory Leak
onBeforeUnmount(() => {
  if (secureImageUrl.value) {
    // Menghapus cache Blob dari memori browser saat pengguna pindah halaman
    URL.revokeObjectURL(secureImageUrl.value);
  }
});
</script>

<style scoped>
.loading-placeholder, .error-placeholder {
  width: 300px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
}
.secured-image {
  width: 100%;
  max-width: 300px;
  border-radius: 8px;
  object-fit: cover;
}
</style>
```

## Catatan Performa (Video Besar)
Pendekatan Blob sangat aman dan lancar untuk foto atau video pendek (di bawah 20MB). 
Namun, jika aplikasi Anda nantinya menangani video raksasa (ratusan MB), men-*download* semuanya ke memori RAM (*Blob*) sebelum diputar bisa membuat browser berat. 
Jika kasus itu terjadi di masa depan, kita perlu merombak perlindungan dari sisi Backend menggunakan *Pre-signed URL* atau *Temporary Token Query*, agar `<video>` bisa melakukan *partial streaming* secara natif.
