/**
 * Config Terpusat Menu Tree & Resource Permissions
 * ────────────────────────────────────────────────────────────────────────────
 * Single Source of Truth untuk data struktur Menu dan Resource Permissions.
 * Digunakan bersama oleh:
 *   - master-tenant.seeder.ts
 *   - menu-role.seeder.ts
 *
 * ⚠️ Mengubah menu di file ini akan otomatis berdampak pada seluruh seeder menu.
 */

export interface MenuSeedItem {
  name: string;
  url?: string;
  icon?: string;
  order_no: number;
  requiredResource?: string;
  children?: MenuSeedItem[];
}

// ─── Resources Terpusat untuk Super Admin ──────────────────────────────────────
export const SUPER_ADMIN_RESOURCES: string[] = [
  // Entitas utama
  'Document',
  'User',
  'Role',
  'Menu',
  'Pegawai',
  'Permission',
  'Tenant',
  'Barang',
  'Gallery',
  'CompanyProfile',
  'WhatsApp',

  // Route-level menu resources
  'menu-album',
  'menu-barang',
  'menu-dashboard',
  'menu-dokumen',
  'menu-galery',
  'menu-list-menu',
  'menu-pegawai-list',
  'menu-profil-pegawai',
  'menu-profil-perusahaan',
  'menu-role',
  'menu-users-list',
  'menu-tenant',
  'menu-whatsapp',
  'menu-pegawai-management',
  'Master Data',
];

// ─── Menu Tree Terpusat (Hierarki Parent - Child) ──────────────────────────────
export const MENU_TREE: MenuSeedItem[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    icon: 'home',
    order_no: 1,
    requiredResource: 'menu-dashboard',
  },
  {
    name: 'Dokumen',
    url: '/dokumen',
    icon: 'folder',
    order_no: 2,
    requiredResource: 'menu-dokumen',
  },
  {
    name: 'Picture',
    url: '',
    icon: 'image',
    order_no: 3,
    requiredResource: '',
    children: [
      {
        name: 'Album',
        url: '/album',
        icon: 'album',
        order_no: 1,
        requiredResource: 'menu-album',
      },
       {
        name: 'Galeri',
        url: '/gallery',
        icon: 'GalleryHorizontalEndIcon',
        order_no: 1,
        requiredResource: 'menu-galeri',
      },
    ],
  },
  {
    name: 'Master Data',
    url: '',
    icon: 'database',
    order_no: 4,
    requiredResource: 'Master Data',
    children: [
      {
        name: 'Barang',
        url: '/barang/listtable',
        icon: 'cube',
        order_no: 1,
        requiredResource: 'menu-barang',
      },
    ],
  },
  {
    name: 'Pesan',
    url: '',
    icon: 'database',
    order_no: 4,
    requiredResource: '',
    children: [
      {
        name: 'Kontak WhatsApp',
        url: '/whatsapp/contacts',
        icon: 'MessageCircleDashed',
        order_no: 1,
        requiredResource: 'menu-kontak-whatsapp',
      },
      {
        name: 'Histori Pesan WhatsApp',
        url: '/whatsapp/history',
        icon: 'MessageCircleIcon',
        order_no: 2,
        requiredResource: 'menu-histori-whatsapp',
      },
    ],
  },
  {
    name: 'Pegawai Management',
    url: '',
    order_no: 4,
    requiredResource: 'menu-pegawai-management',
    children: [
      {
        name: 'Profil Pegawai',
        url: '/profile',
        order_no: 1,
        requiredResource: 'menu-profil-pegawai',
      },
      {
        name: 'Data Pegawai',
        url: '/pegawai',
        order_no: 2,
        requiredResource: 'menu-pegawai-list',
      },
    ],
  },
  {
    name: 'System Managements',
    icon: 'settings',
    order_no: 5,
    children: [
      {
        name: 'User Management',
        url: '/users',
        icon:'User2Icon',
        order_no: 1,
        requiredResource: 'menu-users-list',
      },
      {
        name: 'Role Management',
        url: '/roles',
        icon:'BlocksIcon',
        order_no: 2,
        requiredResource: 'menu-role',
      },
      {
        name: 'Menu Management',
        url: '/menu',
        icon:'menu',
        order_no: 3,
        requiredResource: 'menu-list-menu',
      },
      {
        name: 'Profil Perusahaan',
        url: '/profil-perusahaan',
        icon:'Building2',
        order_no: 5,
        requiredResource: 'menu-profil-perusahaan',
      },
      {
        name: 'Integrasi WhatsApp',
        url: '/whatsapp',
        icon:'MessageCircleMoreIcon',
        order_no: 6,
        requiredResource: 'menu-integrasi-whatsapp',
      },
      {
        name: 'Tenant Master',
        url: '/master/tenant',
        icon:'Landmark',
        order_no: 7,
        requiredResource: 'menu-tenant',
      },
    ],
  },
];
