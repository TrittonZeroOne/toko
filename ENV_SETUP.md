# SETUP GUIDE untuk Environment Variables

## 📝 FRONTEND

### Local Development
1. Cek file: `frontend/.env`
2. Kosongkan `VITE_API_URL` untuk auto-proxy ke backend :8000
3. Atau set ke URL backend remote jika mau test dengan production backend

### Vercel Production
1. Login ke Vercel Dashboard: https://vercel.com/dashboard
2. Pilih project Anda
3. Settings > Environment Variables
4. Tambahkan:
   ```
   Name: VITE_API_URL
   Value: https://your-backend-url.railway.app
   Environment: Production (atau All)
   ```
5. Klik Save dan Re-deploy project

---

## 🔑 BACKEND

### Local Development
1. Cek file: `backend/.env`
2. Lihat contoh di `backend/.env.example`
3. Set minimal:
   - DATABASE_URL: dari Supabase
   - JWT_SECRET: bisa random string, minimal 32 chars
   - MIDTRANS_*: dari Midtrans dashboard
   - SMTP_*: opsional

### Railway Production
1. Login ke Railway: https://railway.app/dashboard
2. Buat project baru atau select existing
3. Add service > GitHub repo
4. Select folder: `backend`
5. Settings > Variables
6. Tambahkan semua env vars dari `backend/.env.example`:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   APP_PUBLIC_URL=https://[project-name]-production.railway.app
   FRONTEND_PUBLIC_URL=https://[vercel-project].vercel.app
   MIDTRANS_SERVER_KEY=...
   dst...
   ```
7. Deploy

### Render Production
1. Login ke Render: https://dashboard.render.com
2. Create > Web Service
3. Connect GitHub repo
4. Configuration:
   - Name: toko-api
   - Environment: Go
   - Build Command: (blank - auto-detect)
   - Start Command: ./main
5. Add Environment: set semua dari `backend/.env.example`
6. Create Web Service

---

## 🎯 REQUIRED ENVIRONMENT VARIABLES

### Backend - Essential
```
DATABASE_URL = postgresql://...
JWT_SECRET = [random 32+ chars]
APP_PUBLIC_URL = https://your-backend-url
FRONTEND_PUBLIC_URL = https://your-frontend-url
MIDTRANS_SERVER_KEY = Mid-server-xxx
MIDTRANS_CLIENT_KEY = SB-Mid-client-xxx
MIDTRANS_MERCHANT_ID = M123456789
MIDTRANS_IS_PRODUCTION = false
```

### Frontend - Essential
```
VITE_API_URL = https://your-backend-url
```

---

## 🧪 TESTING AFTER DEPLOYMENT

### Frontend
```bash
# Check if API requests work
curl -H "Authorization: Bearer TOKEN" \
     https://your-frontend.vercel.app/api/products
```

### Backend
```bash
# Test health check (jika ada route /health)
curl https://your-backend.railway.app/api/products

# Or test database connection
curl https://your-backend.railway.app/api/...
```

### Check Logs
```bash
# Railway
railway logs

# Render
# Dashboard > Project > Logs

# Vercel
# Dashboard > Deployments > Logs
```

---

## 🔗 LINKS GENERATOR

Generate script untuk mudah setup:

```bash
# Vercel URL Checker
https://your-app.vercel.app

# Railway Logs
railway logs -f

# Render Logs
# https://dashboard.render.com/[service-id]/logs
```

---

For detailed setup guide, see: [DEPLOYMENT.md](./DEPLOYMENT.md)
