# Toko - E-Commerce Single Vendor

README ini menjelaskan fitur dan kemampuan aplikasi toko online ini.

## Ringkasan

Aplikasi ini adalah sebuah sistem e-commerce single-vendor dengan:
- Backend Go Fiber + GORM + JWT
- Frontend React + Vite + Tailwind CSS
- Pembayaran Midtrans (sandbox/production)
- Dukungan MySQL lokal atau PostgreSQL/Supabase
- Fitur admin untuk manajemen produk, kategori, pesanan, dan chat

## Fitur Utama

### 1. Produk dan Katalog
- Tampilkan daftar produk publik
- Lihat detail produk lengkap
- Kategori produk untuk pencarian dan filter
- Upload gambar produk untuk admin
- Delete foto produk dan produk untuk admin

### 2. Autentikasi dan Profil Pengguna
- Registrasi pengguna baru
- Login dengan email dan password
- Email verifikasi setelah registrasi
- Kirim ulang email verifikasi
- Reset password melalui OTP / email lupa password
- Halaman profil untuk melihat dan memperbarui data pengguna
- Perubahan password aman bagi pengguna terautentikasi

### 3. Keranjang & Checkout
- Keranjang belanja pengguna tersimpan di frontend
- Halaman checkout untuk mengirimkan pesanan
- Estimasi dan cek ongkir menggunakan API Binderbyte
- Metode pembayaran Midtrans dengan callback webhook
- Tautan kembali/cancel ke frontend setelah pembayaran

### 4. Pesanan & Riwayat
- Pengguna dapat melihat daftar pesanan mereka
- Detail pesanan lengkap termasuk status dan total
- Cetak invoice / order print dari frontend
- Batalkan pesanan sebelum diproses
- Review produk setelah pesanan selesai

### 5. Chat / Customer Support
- Obrolan internal antara pelanggan dan admin
- Chat umum melalui halaman chat
- Daftar pesan per pesanan
- Admin dapat mengirim balasan dan melihat inbox pelanggan

### 6. Admin Panel
- Halaman admin terlindungi untuk role admin
- Manajemen produk: tambah, edit, hapus, dan kelola gambar
- Manajemen kategori: tambah, edit, hapus
- Manajemen order: lihat daftar order, update status pesanan
- Ringkasan penjualan admin
- Chat admin dengan pelanggan

### 7. Konfigurasi Shipping & Ongkos Kirim
- Daftar provinsi, kota, distrik, dan kelurahan/dusun
- Estimasi ongkir berdasarkan produk dan tujuan
- Konfigurasi origin darimana ongkir dihitung

## Struktur Aplikasi

- `backend/` - server Go
  - `main.go` - entrypoint backend
  - `route/route.go` - semua endpoint API
  - `controller/` - logika fitur seperti auth, produk, order, chat, shipping
  - `model/` - definisi model database
  - `service/` - integrasi pihak ketiga (Midtrans, Resend, Binderbyte)
  - `storage/` - upload gambar produk
- `frontend/` - SPA React
  - `src/App.jsx` - routing aplikasi
  - `src/pages/` - halaman utama pengguna dan admin
  - `src/api.js` - fungsi pemanggilan API backend
  - `src/cartStore.js` - manajemen keranjang belanja
  - `src/auth.jsx` - manajemen otentikasi dan proteksi rute

## Halaman Frontend Utama

- `/` - Halaman beranda / daftar produk
- `/product/:id` - Detail produk
- `/login` - Halaman masuk
- `/register` - Halaman daftar
- `/verify-email` - Verifikasi email pengguna
- `/cart` - Keranjang belanja pengguna
- `/checkout` - Proses checkout pesanan
- `/profile` - Profil pengguna
- `/orders` - Daftar pesanan
- `/orders/:id/print` - Cetak detail pesanan
- `/chat` - Obrolan pengguna
- `/admin` - Dashboard admin
- `/admin/chat` - Chat admin
- `/admin/orders/:id/print` - Cetak pesanan admin

## Konfigurasi Environment Backend

Salin `backend/.env.example` menjadi `backend/.env` lalu isi nilai berikut:

- `APP_PORT`
- `JWT_SECRET`
- `UPLOAD_DIR`
- `DB_DRIVER`
- `DATABASE_URL` atau konfigurasi MySQL / PostgreSQL
- `APP_PUBLIC_URL`
- `FRONTEND_PUBLIC_URL`
- `CORS_ALLOWED_ORIGINS`
- `MIDTRANS_*` untuk pembayaran
- `BINDERBYTE_API_KEY` untuk ongkos kirim
- `RESEND_API_KEY` atau SMTP untuk email

## Instalasi Singkat

1. Backend:
   - `cd backend`
   - `go mod tidy`
   - `go run .`
2. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Deployment

- Frontend dapat dideploy ke Vercel dengan `frontend/dist` sebagai output
- Backend harus dideploy ke hosting Go (Railway, Render, Fly.io, VPS, dsb.)
- Pastikan `VITE_API_URL` di frontend menunjuk ke URL backend publik

## Catatan

- Aplikasi ini didesain untuk toko online single-vendor
- Backend sudah mendukung database MySQL dan PostgreSQL
- Midtrans digunakan untuk integrasi pembayaran
- Binderbyte digunakan untuk data wilayah Indonesia dan ongkir
- Admin dan customer memiliki akses terpisah sesuai role
