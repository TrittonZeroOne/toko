# Toko - E-Commerce Single Vendor

Fullstack toko online: backend **Go Fiber + GORM + JWT**, frontend **React Vite + Tailwind**, pembayaran **Midtrans**, database **MySQL lokal** atau **PostgreSQL/Supabase**.

## Struktur Deploy

- **Vercel** dipakai untuk frontend React.
- **Backend Go Fiber** perlu hosting terpisah, misalnya Railway, Render, Fly.io, VPS, atau layanan lain yang bisa menjalankan Go HTTP server.
- Setelah backend punya URL publik, isi `VITE_API_URL` di Vercel dengan URL backend tersebut.

## Environment Frontend Vercel

Set di **Vercel > Project > Settings > Environment Variables**:

```env
VITE_API_URL=https://url-backend-anda
```

Jangan isi `SUPABASE_SERVICE_KEY` atau key rahasia lain di frontend.

## Environment Backend

Salin `backend/.env.example` menjadi `.env` di hosting backend, lalu isi minimal:

```env
APP_PORT=8000
JWT_SECRET=ganti-dengan-string-panjang-acak
DB_DRIVER=postgres
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@.../postgres?sslmode=require
FRONTEND_PUBLIC_URL=https://nama-project.vercel.app
CORS_ALLOWED_ORIGINS=https://nama-project.vercel.app
APP_PUBLIC_URL=https://url-backend-anda
```

Tambahkan sesuai fitur yang dipakai:

```env
MIDTRANS_MERCHANT_ID=
MIDTRANS_CLIENT_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
RESEND_API_KEY=
BINDERBYTE_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SUPABASE_STORAGE_BUCKET=product-images
```

## Setting Vercel

Repository root tetap folder ini. `vercel.json` sudah mengatur:

- install: `cd frontend && npm install`
- build: `cd frontend && npm run build`
- output: `frontend/dist`
- rewrite SPA ke `index.html`

## Cek Lokal

Frontend:

```powershell
cd frontend
npm install
npm run build
```

Backend:

```powershell
cd backend
go mod tidy
go run .
```

Health check backend:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

## Langkah Upload ke GitHub

```powershell
git init
git add .
git commit -m "Prepare Vercel deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA_REPO.git
git push -u origin main
```

Setelah itu import repository di Vercel, isi environment `VITE_API_URL`, lalu deploy.
