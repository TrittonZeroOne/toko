# 🚀 Vercel Deployment Setup - Summary

Semua file yang diperlukan untuk deploy ke Vercel sudah siap! Berikut penjelasannya:

## 📁 Files yang Sudah Disiapkan

### Configuration Files
- ✅ **vercel.json** - Konfigurasi Vercel (build, output directory, cache headers)
- ✅ **frontend/.env.example** - Template env variables frontend
- ✅ **frontend/.env.production** - Reference untuk production
- ✅ **backend/.env.example** - Template env variables backend dengan dokumentasi lengkap

### Setup Scripts
- ✅ **setup.bat** - Auto-setup untuk Windows
- ✅ **setup.sh** - Auto-setup untuk Linux/Mac

### Documentation
- ✅ **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Panduan lengkap deployment (Vercel + Railway/Render)
- ✅ **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Checklist & quick reference
- ✅ **[ENV_SETUP.md](./ENV_SETUP.md)** - Quick guide environment variables

---

## 🎯 Quick Start (3 Steps)

### 1️⃣ Local Setup
```bash
# Windows
setup.bat

# Linux/Mac
bash setup.sh
```

### 2️⃣ Edit Environment Files
- Edit `frontend/.env` dengan backend URL lokal atau remote
- Edit `backend/.env` dengan credentials Anda (Supabase, Midtrans, SMTP, dll)

### 3️⃣ Test Lokal
```bash
# Terminal 1
cd frontend && npm run dev

# Terminal 2
cd backend && go run main.go
```

---

## 🌐 Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│         Frontend (React + Vite)                 │
│         Vercel: your-app.vercel.app            │
│         ├── Environment: VITE_API_URL           │
│         └── Points to: Backend URL              │
└─────────────────────────────────────────────────┘
                        │
                        │ API Calls
                        ▼
┌─────────────────────────────────────────────────┐
│        Backend (Go + Fiber API)                 │
│        Railway: toko-api-production-xxxx.railway.app │
│        ├── Environment: DATABASE_URL, etc       │
│        └── Database: Supabase PostgreSQL        │
└─────────────────────────────────────────────────┘
```

---

## 📋 Minimal Environment Variables Needed

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend-url.railway.app
```

### Backend (Railway)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random string>
APP_PUBLIC_URL=https://your-backend-url.railway.app
FRONTEND_PUBLIC_URL=https://your-frontend-url.vercel.app

# Payment & Email (optional but recommended)
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
RESEND_API_KEY=... (or SMTP_*)
BINDERBYTE_API_KEY=...
```

---

## 🚀 Deployment Steps

### Frontend → Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Select GitHub repo `TrittonZeroOne/toko`
4. Vercel auto-detect `vercel.json` settings ✓
5. Add Environment Variables > `VITE_API_URL`
6. Deploy!

### Backend → Railway

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Select repo, configure root directory: `backend`
4. Add Environment Variables (from `backend/.env.example`)
5. Deploy!

📖 **Detailed steps in**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## ⚠️ Important Notes

### Go Backend on Vercel?
❌ **NOT supported** - Vercel hanya support Node.js, Python, Ruby

✅ **Solution**: Deploy Go backend ke:
- **Railway.app** (recommended, mudah)
- **Render.com** (alternatif)
- **Server sendiri** (dengan setup lebih kompleks)

### Environment Variables
- 🔒 `.env` files are **git-ignored** (security)
- ✅ Set di platform masing-masing:
  - Vercel Dashboard > Settings > Environment Variables
  - Railway Dashboard > Project > Variables
- ⚠️ Jangan commit `.env` ke Git!

### Local Development
- 🔗 Frontend auto-proxy `/api/*` ke backend `:8000` via Vite proxy
- ✅ Kosongkan `VITE_API_URL` di `.env` lokal
- 🔄 Atau set ke URL remote backend jika mau test dengan production data

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "API not found" / 404 | Pastikan `VITE_API_URL` set di Vercel, dan backend URL accessible |
| CORS error | Set `FRONTEND_PUBLIC_URL` di backend .env |
| Database connection error | Check `DATABASE_URL` format & password |
| Midtrans webhook not working | Set `APP_PUBLIC_URL` & `MIDTRANS_NOTIFY_URL` di backend .env |

📖 More troubleshooting in [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting)

---

## 📚 Documentation Files

1. **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** ← Start here! Quick reference + checklist
2. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed guide lengkap
3. **[ENV_SETUP.md](./ENV_SETUP.md)** - Environment variables quick setup
4. **[backend/.env.example](./backend/.env.example)** - All backend env variables documented
5. **[frontend/.env.example](./frontend/.env.example)** - Frontend env setup

---

## 🎓 Learn More

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)

---

## 📞 Need Help?

1. Check [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) troubleshooting section
2. Check platform logs:
   - Vercel: Dashboard > Deployments > Logs
   - Railway: `railway logs -f`
3. Check database connection in Supabase dashboard

---

**Ready to deploy?** → Start with [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) ✅
