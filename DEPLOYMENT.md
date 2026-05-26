# 🚀 Panduan Deploy ke Vercel & Production

Dokumen ini menjelaskan cara deploy aplikasi fullstack (React Frontend + Go Backend) ke Vercel dengan setup environment yang tepat.

## 📋 Daftar Isi
1. [Architecture](#architecture)
2. [Frontend - Deploy ke Vercel](#frontend---deploy-ke-vercel)
3. [Backend - Deploy ke Railway/Render](#backend---deploy-ke-railwayrender)
4. [Environment Variables](#environment-variables)
5. [Konfigurasi DNS & CORS](#konfigurasi-dns--cors)
6. [Checklist Deployment](#checklist-deployment)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Browser                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─────────────────┬──────────────────┐
                     ▼                 ▼                  ▼
           Frontend React       Vite Build          Assets (JS/CSS)
           (Vercel)             Output
           
┌────────────────────────────────────────────────────────────────┐
│                    Vercel CDN                                  │
│  https://your-app.vercel.app                                  │
└──────────────┬─────────────────────────────────────────────────┘
               │
               └──────────────────► API Calls (via VITE_API_URL)
                                   
                                   │
                                   ▼
                    
                    ┌──────────────────────────────────────┐
                    │   Go Backend / API Server            │
                    │   (Railway/Render/Server sendiri)    │
                    │   https://your-api.railway.app       │
                    └──────────┬───────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────────────────────┐
                    │     Supabase PostgreSQL Database     │
                    │     + Storage (uploads)              │
                    └──────────────────────────────────────┘
```

---

## Frontend - Deploy ke Vercel

### Step 1: Siapkan Repository

Frontend sudah dikonfigurasi dengan `vercel.json`. Pastikan:

```bash
# Frontend folder structure
frontend/
├── src/
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

### Step 2: Set Environment Variables di Vercel

1. **Login ke [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Import project** dari GitHub/GitLab
3. **Pilih folder root**: tetap di root project (toko)
4. **Build settings**: Vercel otomatis mendeteksi dari `vercel.json`
5. **Environment Variables** → Tambahkan:

```
VITE_API_URL=https://your-backend-url.railway.app
```

### Step 3: Deploy

```bash
# Vercel CLI (opsional)
npm install -g vercel
cd c:\laragon\www\toko
vercel
```

Atau langsung melalui GitHub push (auto-deploy jika sudah connected).

---

## Backend - Deploy ke Railway/Render

Karena Go tidak support Vercel directly, gunakan Railway atau Render.

### Option A: Railway (Recommended)

#### 1. Siapkan Backend

```bash
# Pastikan ada Go.mod
cd backend
cat go.mod
```

#### 2. Login Railway & Create Project

```bash
npm install -g @railway/cli
railway login
railway init
```

#### 3. Set Environment Variables

Di Railway Dashboard > Project > Variables, set semua dari `backend/.env.example`:

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
APP_PUBLIC_URL=https://your-api-production-xxxx.railway.app
FRONTEND_PUBLIC_URL=https://your-app.vercel.app
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
... (lihat backend/.env.example)
```

#### 4. Deploy

```bash
railway up
```

Railway akan otomatis:
- Build Go application
- Generate domain: `https://your-api-production-xxxx.railway.app`
- Expose port (default 8000)

### Option B: Render

#### 1. Create Service di [Render.com](https://render.com)

- Service type: **Web Service**
- Environment: **Go**
- Build command: (kosong, Render auto-detect)
- Start command: `./main` (atau `go run main.go`)

#### 2. Set Environment Variables

Copy-paste dari `backend/.env.example`

#### 3. Deploy

Push ke GitHub, Render auto-deploy.

---

## Environment Variables

### Frontend (.env / Vercel)

| Variable | Local Dev | Production | Deskripsi |
|----------|-----------|-----------|-----------|
| `VITE_API_URL` | _(kosong)_ | `https://your-api.railway.app` | Backend URL |

**File lokasi**:
- Dev: `frontend/.env` (buat copy dari `.env.example`)
- Production: Set di Vercel Dashboard

### Backend (.env / Railway/Render)

Lihat `backend/.env.example` untuk daftar lengkap.

**Minimal untuk Production**:

```env
APP_PORT=8000
JWT_SECRET=<generate-with-openssl-rand-hex-32>
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_DRIVER=postgres

APP_PUBLIC_URL=https://your-api.railway.app
FRONTEND_PUBLIC_URL=https://your-app.vercel.app

MIDTRANS_SERVER_KEY=Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false

SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=<app-password>
SMTP_PORT=587

BINDERBYTE_API_KEY=your-key
RESEND_API_KEY=<optional>
```

### Generate JWT Secret

```bash
# Windows PowerShell
[System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32) | ForEach-Object { [Convert]::ToString($_, 16).PadLeft(2, '0') } | Join-String

# atau Linux/Mac
openssl rand -hex 32
```

---

## Konfigurasi DNS & CORS

### CORS Setup (Backend)

Backend otomatis allow CORS dari origin yang cocok. Set di `backend/.env`:

```env
FRONTEND_PUBLIC_URL=https://your-app.vercel.app
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.domain-anda.com
```

### Midtrans Redirect URLs

Set di `backend/.env`:

```env
MIDTRANS_RETURN_URL=https://your-app.vercel.app/orders
MIDTRANS_CANCEL_URL=https://your-app.vercel.app/orders
MIDTRANS_NOTIFY_URL=https://your-api.railway.app/api/midtrans-webhook
```

### Custom Domain

**Frontend (Vercel)**:
1. Dashboard > Project > Settings > Domains
2. Add custom domain: `app.domain.com`
3. Update DNS di registrar CNAME → Vercel

**Backend (Railway)**:
1. Project > Custom Domain
2. Add custom domain: `api.domain.com`
3. Update DNS CNAME

---

## Checklist Deployment

### Pre-Deployment ✓

- [ ] Isi `backend/.env.example` lengkap (copy ke `backend/.env` lokal)
- [ ] Isi `frontend/.env.example` lengkap (copy ke `frontend/.env` lokal)
- [ ] Test lokal: `npm run dev` di frontend + `go run main.go` di backend
- [ ] Push ke GitHub (siap untuk deploy)

### Frontend (Vercel)

- [ ] Login Vercel.com
- [ ] Import GitHub repo
- [ ] Build settings auto-detect dari `vercel.json` ✓
- [ ] Set Environment Variables > `VITE_API_URL`
- [ ] Deploy via "Deploy" button atau auto-deploy on push

### Backend (Railway/Render)

**Railway**:
- [ ] Railway login: `railway login`
- [ ] Init project: `railway init` (dari root folder)
- [ ] Set semua env variables di Railway Dashboard
- [ ] Deploy: `railway up`
- [ ] Cek URL: `railway status` → copy domain

**Render**:
- [ ] Create Web Service di render.com
- [ ] Connect GitHub repo
- [ ] Set environment variables
- [ ] Deploy → tunggu ~5 menit

### Post-Deployment ✓

- [ ] Cek Frontend: buka https://your-app.vercel.app
- [ ] Cek Backend: buka https://your-api.railway.app/api/health (atau route lain)
- [ ] Test API Call: buka DevTools > Network > cek request ke backend
- [ ] Test Login: coba login dengan account
- [ ] Test Payment: coba checkout (Midtrans sandbox)
- [ ] Monitor logs:
  - Vercel: Dashboard > Deployments > Logs
  - Railway: `railway logs`
  - Render: Project > Logs

---

## Troubleshooting

### Frontend tidak bisa connect ke backend

**Gejala**: API error "Failed to fetch" atau CORS error

**Solusi**:
1. Pastikan `VITE_API_URL` set dengan benar di Vercel
2. Cek backend URL: `https://your-api-xxx.railway.app` accessible
3. Check CORS:
   ```bash
   curl -H "Origin: https://your-app.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS https://your-api.railway.app/api/products -v
   ```

### Backend Database Error

**Gejala**: "connection refused" atau "invalid password"

**Solusi**:
1. Cek `DATABASE_URL` format di Railway/Render env vars
2. Pastikan IP Supabase accessible (firewall)
3. Cek password database Supabase benar

### Midtrans Webhook Not Working

**Gejala**: Payment callback tidak masuk

**Solusi**:
1. Set `APP_PUBLIC_URL` = backend URL yang benar
2. Set `MIDTRANS_NOTIFY_URL` lengkap dengan path `/api/midtrans-webhook`
3. Test webhook di Midtrans Dashboard > Settings > Technical

---

## Links & Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Midtrans Docs](https://docs.midtrans.com)

---

**Created**: May 2026  
**Last Updated**: May 26, 2026
