# 🚀 DEPLOYMENT CHECKLIST - Quick Reference

## 📋 Pre-Deployment Checklist

### ✅ Code & Configuration
- [ ] Semua code sudah push ke GitHub
- [ ] `vercel.json` sudah up-to-date
- [ ] `frontend/.env.example` lengkap
- [ ] `backend/.env.example` lengkap
- [ ] `.gitignore` sudah exclude `.env` files

### ✅ Local Testing
```bash
# Terminal 1 - Frontend
cd frontend && npm run dev

# Terminal 2 - Backend
cd backend && go run main.go

# Test di browser
http://localhost:5173
```

- [ ] Frontend bisa buka tanpa error
- [ ] Login/Register bekerja
- [ ] Bisa lihat products
- [ ] API calls berhasil (cek DevTools Network)

---

## 🌐 FRONTEND DEPLOYMENT (Vercel)

### Step 1: Vercel Dashboard

1. Buka https://vercel.com/dashboard
2. Click "Add New..." > "Project"
3. Pilih repository `TrittonZeroOne/toko`
4. **Framework Preset**: Vite
5. **Root Directory**: `.` (root)
6. **Build Command**: `cd frontend && npm install && npm run build`
7. **Output Directory**: `frontend/dist`

### Step 2: Environment Variables

Di Vercel Dashboard > Settings > Environment Variables, tambahkan:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_URL` | `https://your-backend-url.railway.app` | Production |

### Step 3: Deploy

Click "Deploy" - Vercel akan build & deploy.

Frontend URL: `https://your-project.vercel.app`

---

## 🔧 BACKEND DEPLOYMENT (Railway.app)

### Step 1: Prepare Repository

Backend tidak perlu setup khusus - Railway auto-detect Go project.

### Step 2: Railway Dashboard

1. Buka https://railway.app/dashboard
2. Click "New Project"
3. "Deploy from GitHub" > Pilih `TrittonZeroOne/toko`
4. "Configure service":
   - Service Name: `toko-api`
   - Root Directory: `backend`
5. Click "Deploy"

### Step 3: Environment Variables

Di Railway > Project > Variables, set semua dari `backend/.env.example`:

```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
JWT_SECRET=<generate-with-openssl-rand-hex-32>
APP_PUBLIC_URL=https://toko-api-production-xxxx.railway.app
FRONTEND_PUBLIC_URL=https://your-project.vercel.app

MIDTRANS_MERCHANT_ID=M000000000
MIDTRANS_SERVER_KEY=Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=<app-password>
SMTP_FROM=Toko <your-email@gmail.com>

RESEND_API_KEY=<optional>
RESEND_FROM=Toko <onboarding@resend.dev>

BINDERBYTE_API_KEY=your-key
BINDERBYTE_ORIGIN=jakarta

APP_NAME=Toko
```

Railway auto-deploy ketika ada variable yang berubah.

Backend URL: `https://toko-api-production-xxxx.railway.app`

---

## 🔄 Post-Deployment Verification

### ✅ Frontend Health Check

```bash
# Test frontend loads
curl https://your-project.vercel.app

# Should return HTML content
```

### ✅ Backend Health Check

```bash
# Test backend API
curl https://toko-api-production-xxxx.railway.app/api/products

# Should return JSON list of products (atau empty array if no products)
```

### ✅ API Connection Test

Buka DevTools (F12) > Network tab:

1. Buka https://your-project.vercel.app
2. Lakukan action (login, lihat products, dll)
3. Lihat request ke backend di Network tab
4. Should show requests ke `toko-api-production-xxxx.railway.app`

---

## 🐛 Troubleshooting

### Frontend - API 404/500 Error

**Problem**: Requests ke backend return 404 atau 500

**Checklist**:
- [ ] `VITE_API_URL` set di Vercel dengan URL backend yang benar
- [ ] Backend URL accessible dari browser (buka di tab baru)
- [ ] JWT_SECRET & DATABASE_URL set di Railway

**Debug**:
```bash
# Test backend directly
curl https://toko-api-production-xxxx.railway.app/api/products -v

# Check Railway logs
railway logs -f

# Check Vercel build logs
# Dashboard > Deployments > click latest > Logs
```

### Frontend - CORS Error

**Problem**: Browser console: "Access to XMLHttpRequest at '...' from origin '...' has been blocked"

**Solution**:
1. Cek backend logs untuk CORS header
2. Pastikan `FRONTEND_PUBLIC_URL` set di backend .env
3. Railway perlu di-redeploy setelah env var change

### Backend - Database Connection Error

**Problem**: "connection refused" atau "invalid password"

**Checklist**:
- [ ] `DATABASE_URL` format benar
- [ ] Database credentials benar (copy dari Supabase)
- [ ] Supabase IP firewall allow Railway IP

**Debug**:
```bash
# Check Railway logs
railway logs -f

# Look for: "database: " error messages
```

---

## 📊 Monitoring & Logs

### Vercel Logs
```
Dashboard > Deployments > Click latest deployment > Logs
```

### Railway Logs
```bash
railway logs -f        # Follow live logs
railway logs --lines=100  # Last 100 lines
```

### Sentry / Error Tracking (Optional)
Tambahkan later jika perlu error monitoring.

---

## 🔐 Security Checklist

- [ ] `.env` file NOT in Git (check `.gitignore`)
- [ ] Production credentials NEVER in code
- [ ] `JWT_SECRET` is random & long (32+ chars)
- [ ] Database password from Supabase (not hardcoded)
- [ ] Midtrans keys dari Midtrans dashboard, bukan hardcoded
- [ ] Frontend `.env.production` tidak override local dev config

---

## 📝 Final Setup Summary

| Component | URL | Platform | Notes |
|-----------|-----|----------|-------|
| Frontend | https://your-project.vercel.app | Vercel | SPA, React |
| Backend | https://toko-api-production-xxxx.railway.app | Railway | Go API |
| Database | Supabase PostgreSQL | Supabase | Managed DB |
| Storage | Supabase Storage | Supabase | Image uploads |
| Email | Resend.dev / Gmail SMTP | External | Email verification |
| Payment | Midtrans | Midtrans | Payment gateway |

---

## 🚀 Next Steps

1. Follow checklist di atas
2. Test di production
3. Monitor logs untuk error
4. Update DNS jika pakai custom domain
5. Setup CI/CD (GitHub Actions) jika diperlukan

---

**For detailed guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)  
**For env setup**: [ENV_SETUP.md](./ENV_SETUP.md)  
**Quick setup**: Run `setup.bat` (Windows) atau `setup.sh` (Linux/Mac)
