#!/bin/bash
# Quick setup script untuk local development

set -e

echo "🚀 TOKO - Local Development Setup"
echo "=================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js"
    exit 1
fi

# Check Go
if ! command -v go &> /dev/null; then
    echo "❌ Go not found. Please install Go"
    exit 1
fi

echo "✓ Node.js: $(node --version)"
echo "✓ Go: $(go version)"

# Setup Frontend
echo ""
echo "📦 Setting up Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

# Setup .env jika belum ada
if [ ! -f ".env" ]; then
    echo "Creating frontend/.env from .env.example"
    cp .env.example .env
fi
echo "✓ Frontend ready"
cd ..

# Setup Backend
echo ""
echo "📦 Setting up Backend..."
cd backend
if [ ! -f ".env" ]; then
    echo "Creating backend/.env from .env.example"
    cp .env.example .env
    echo "⚠️  Edit backend/.env dengan database credentials Anda"
fi

# Check go.mod
if [ ! -f "go.mod" ]; then
    echo "⚠️  go.mod not found"
else
    echo "✓ go.mod exists"
    echo "  Run: cd backend && go mod tidy"
fi
echo "✓ Backend ready"
cd ..

echo ""
echo "=================================="
echo "✅ Setup Complete!"
echo ""
echo "🏃 To start development:"
echo ""
echo "Terminal 1 - Frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "Terminal 2 - Backend:"
echo "  cd backend && go run main.go"
echo ""
echo "📝 Edit .env files sesuai kebutuhan Anda"
echo "📄 Lihat DEPLOYMENT.md untuk production setup"
echo ""
