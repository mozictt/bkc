# Panduan Pengelolaan & Eksekusi Database Seeder (Menu Tree & Permissions)

Dokumen ini berisi panduan lengkap mengenai arsitektur, cara konfigurasi, dan perintah eksekusi Database Seeder untuk aplikasi NestJS Backend, terutama mengenai pengolahan **Menu Tree (Parent-Child)**, **Roles**, **Permissions**, dan **Multi-Tenancy Integration**.

---

## 📋 Ringkasan Perintah Eksekusi

| Kebutuhan | Perintah di Docker (Server) | Perintah Lokal |
| :--- | :--- | :--- |
| **Seeder Menu & Role Saja** | `docker exec -it backend_app npx ts-node src/database/seed-menu.ts` | `npm run seed:menu` |
| **Seluruh Seeder (Full Seed)** | `docker exec -it backend_app npm run seed` | `npm run seed` |

---

## 🏗️ Struktur Arsitektur Seeder

Sistem seeder dirancang dengan prinsip **Single Source of Truth** dan **DRY (Don't Repeat Yourself)**:

| File / Modul | Fungsi & Peran Utama |
| :--- | :--- |
| **[src/database/seeds/menu-tree.config.ts](file:///home/mozict/project/backend/src/database/seeds/menu-tree.config.ts)** | **Satu-satunya tempat** konfigurasi susunan `MENU_TREE` (Parent & Sub-menu) dan daftar resource permissions. |
| **[src/database/seeds/menu-role.seeder.ts](file:///home/mozict/project/backend/src/database/seeds/menu-role.seeder.ts)** | Skrip pemroses yang membaca `MENU_TREE`, menghapus menu lama, mengikat `tenant_id` Master Tenant, dan mengosongkan cache Redis. |
| **[src/database/seeds/master-tenant.seeder.ts](file:///home/mozict/project/backend/src/database/seeds/master-tenant.seeder.ts)** | Seeder awal untuk membuat Master Tenant (`is_master = true`), Role Super Admin, dan akun User Super Admin. |
| **[src/database/seed-menu.ts](file:///home/mozict/project/backend/src/database/seed-menu.ts)** | Runner mandiri (*standalone*) khusus untuk eksekusi seeder menu & role. |
| **[src/database/seed-runner.ts](file:///home/mozict/project/backend/src/database/seed-runner.ts)** | Runner utama untuk eksekusi berurutan seluruh seeder (Master Tenant -> Menu/Role -> Wilayah). |

---

## 🛠️ Cara Mengubah & Menambah Menu Tree

Untuk menambah menu baru, mengubah nama/icon/route URL, atau mengatur hierarki sub-menu, Anda **CUKUP MENGEDIT 1 FILE**:
👉 **`src/database/seeds/menu-tree.config.ts`**

### ⚠️ Aturan Penting Pengisian `MENU_TREE`:
1. **Keunikan Properti**: Setiap menu/sub-menu **WAJIB** memiliki `name`, `url`, dan `requiredResource` yang unik agar tidak terjadi bentrok (*overwriting bug*).
2. **Sub-Menu (Children)**: Gunakan properti `children: [...]` untuk membuat menu bertingkat.
3. **Urutan Tampilan**: Gunakan `order_no` (1, 2, 3...) untuk menentukan urutan menu pada sidebar frontend.

### Contoh Konfigurasi Menu:

```typescript
export const MENU_TREE: MenuSeedItem[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    icon: 'home',
    order_no: 1,
    requiredResource: 'menu-dashboard',
  },
  {
    name: 'Master Data',
    url: '',
    icon: 'database',
    order_no: 4,
    requiredResource: 'Master Data',
    children: [ // 👈 Sub-menu di bawah Master Data
      {
        name: 'Barang',
        url: '/barang/listtable',
        icon: 'cube',
        order_no: 1,
        requiredResource: 'menu-barang',
      },
      {
        name: 'Data Pegawai',
        url: '/pegawai',
        icon: 'list',
        order_no: 2,
        requiredResource: 'menu-pegawai-list',
      },
    ],
  },
];
```

---

## 🚀 Langkah-Langkah Eksekusi Seeder di Server Production (Docker)

Jika Anda telah mengedit file `menu-tree.config.ts` di komputer lokal:

### Langkah 1: Push Perubahan Kode ke Git
```bash
git add .
git commit -m "feat: update menu tree structure and permissions"
git push origin main
```

### Langkah 2: Jalankan Seeder di Server via Docker
Buka terminal server Anda di direktori `/var/www/backend`:

```bash
# Pull kode terbaru
git pull

# Jalankan seeder menu secara langsung di dalam kontainer Docker
docker exec -it backend_app npx ts-node src/database/seed-menu.ts
```

---

## 🧹 Fitur Otomatisasi Seeder

Saat seeder dijalankan (`npm run seed:menu` atau `npx ts-node src/database/seed-menu.ts`), sistem otomatis melakukan langkah-langkah berikut:
1. **Non-Destructive In-Place Upsert (Proteksi Multi-Tenant Total)**:
   - **TIDAK MENJALANKAN `DELETE FROM menus`**, sehingga mencegah *cascading deletion* pada menu tenant lain.
   - Pencarian menu lama secara ketat dibatasi hanya pada Master Tenant (`tenant_id = masterTenant.id`) atau menu Global (`tenant_id IS NULL`).
   - **Menu milik tenant lain (`tenant_id` selain Master Tenant) TIDAK AKAN PERNAH tersentuh, diubah, maupun dihapus**.
2. **Master Tenant Binding**: Mengikat `tenant_id` dari Master Tenant (`is_master = true`) ke seluruh menu dan permission yang baru disemai atau diperbarui.
3. **Invalidasi Cache Redis**: Menghapuskan key Redis `menus:*` secara otomatis sehingga frontend Vue/Nuxt langsung menampilkan struktur menu terbaru tanpa jeda cache.
