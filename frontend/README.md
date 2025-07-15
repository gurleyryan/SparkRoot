# 🃏 MTG Collection Optimizer - Frontend

**Professional Next.js 15 + React 19 frontend for Magic: The Gathering collection management and deck optimization.**

## ✨ Features

- 🎨 **Dark MTG-themed UI** with Beleren-inspired typography
- 🔐 **JWT Authentication** with secure user management  
- 📱 **Responsive Design** optimized for all devices
- ⚡ **Next.js 15** with App Router and React 19
- 🎯 **TypeScript** with 100% type coverage
- 🎨 **Tailwind CSS v4** with custom MTG color palette
- 🔤 **Next.js Font Optimization** with Cinzel, Source Sans 3, JetBrains Mono

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🏗️ Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with fonts
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Navigation.tsx     # Header navigation
│   ├── AuthModal.tsx      # Login/signup modal
│   ├── CollectionUpload.tsx # CSV upload
│   └── CollectionGrid.tsx # Collection display
├── lib/                   # Utilities
│   ├── api.ts            # API client
│   └── utils.ts          # Helper functions
├── stores/               # Zustand state management
│   ├── auth.ts          # Authentication state
│   ├── collection.ts    # Collection state
│   └── ui.ts           # UI state
└── types/               # TypeScript definitions
    └── index.ts        # All type definitions
```

## 🎨 Styling

- **CSS Framework**: Tailwind CSS v4
- **Typography**: Next.js optimized Google Fonts
- **Theme**: Dark MTG-inspired color palette
- **Icons**: Lucide React icons
- **Responsive**: Mobile-first approach

## 🔧 Technical Stack

- **Framework**: Next.js 15 with App Router
- **React**: React 19 with TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS v4
- **Authentication**: JWT with secure storage
- **API Client**: Fetch with error handling
- **Build Tool**: Next.js built-in
- **Type Safety**: 100% TypeScript coverage

## 📡 API Integration

The frontend connects to the FastAPI backend at `http://localhost:8000` with endpoints for:
- User authentication (`/auth/`)
- Collection management (`/collections/`)
- Card data (`/cards/`)
- Pricing (`/pricing/`)

## 🚀 Deployment

Ready for deployment on Vercel:

1. Push to GitHub repository
2. Connect to Vercel
3. Configure environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```
4. Deploy automatically

The build is optimized and production-ready with:
- ✅ Zero ESLint errors
- ✅ Zero TypeScript errors  
- ✅ Optimized fonts and assets
- ✅ Performance best practices
