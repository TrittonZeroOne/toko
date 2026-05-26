@echo off
REM Quick setup script untuk local development di Windows

echo.
echo 🚀 TOKO - Local Development Setup (Windows)
echo ==========================================

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Check Go
where go >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Go not found. Please install Go from https://golang.org/
    exit /b 1
)

echo ✓ Node.js: 
node --version

echo ✓ Go: 
go version

REM Setup Frontend
echo.
echo 📦 Setting up Frontend...
cd frontend
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

if not exist ".env" (
    echo Creating frontend\.env from .env.example
    copy .env.example .env >nul
)
echo ✓ Frontend ready
cd ..

REM Setup Backend
echo.
echo 📦 Setting up Backend...
cd backend
if not exist ".env" (
    echo Creating backend\.env from .env.example
    copy .env.example .env >nul
    echo ⚠️  Edit backend\.env dengan database credentials Anda
)

if exist "go.mod" (
    echo ✓ go.mod exists
    echo   Run: cd backend ^&^& go mod tidy
) else (
    echo ⚠️  go.mod not found
)
echo ✓ Backend ready
cd ..

echo.
echo ==========================================
echo ✅ Setup Complete!
echo.
echo 🏃 To start development:
echo.
echo Terminal 1 - Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo Terminal 2 - Backend:
echo   cd backend
echo   go run main.go
echo.
echo 📝 Edit .env files sesuai kebutuhan Anda
echo 📄 Lihat DEPLOYMENT.md untuk production setup
echo.
pause
