#!/bin/bash
echo "=== VERCEL BUILD SCRIPT ==="
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

echo "=== Checking for frontend directory ==="
if [ -d "frontend" ]; then
    echo "✅ Frontend directory found"
    cd frontend
    echo "✅ Changed to frontend directory"
    echo "Installing dependencies..."
    npm ci
    echo "✅ Dependencies installed"
    echo "Building Next.js app..."
    npm run build
    echo "✅ Build complete"
else
    echo "❌ Frontend directory not found"
    echo "Available directories:"
    find . -maxdepth 2 -type d
    exit 1
fi
