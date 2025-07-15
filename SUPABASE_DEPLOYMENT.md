# 🚀 MTG Deck Optimizer - Supabase Deployment Guide

## ✅ **What You Need**
- Supabase account (free tier works!)
- Railway account (for backend hosting)
- Vercel account (for frontend hosting)
- GitHub repository

---

## 🗄️ **Step 1: Supabase Setup**

### **1.1 Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Sign up/login
3. Click "New Project"
4. Choose organization
5. Set project name: `mtg-deck-optimizer`
6. Set database password (SAVE THIS!)
7. Choose region closest to you
8. Click "Create new project"

### **1.2 Run Database Setup**
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_setup.sql`
4. Click **Run** to create all tables

### **1.3 Get Your Credentials**
Go to **Settings > API** and note:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon/Public Key**: `eyJ...` (starts with eyJ)
- **Service Role Key**: `eyJ...` (keep secret!)
- **Database URL**: Available in Settings > Database

---

## 🖥️ **Step 2: Backend Deployment (Railway)**

### **2.1 Prepare Backend**
1. Install new dependencies:
   ```bash
   cd backend
   pip install psycopg2-binary
   ```

2. Create `.env` file in backend folder:
   ```env
   # Copy from .env.example and fill in your values
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...your-anon-key
   SUPABASE_SERVICE_KEY=eyJ...your-service-key
   DATABASE_URL=postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
   SECRET_KEY=your-super-secret-jwt-key-here
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```

### **2.2 Deploy to Railway**
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub account
3. Click "New Project" > "Deploy from GitHub repo"
4. Select your MTG-Deck-Optimizer repository
5. **Important**: Set root directory to `/backend`
6. Railway will auto-detect it's a Python app

### **2.3 Configure Railway Environment**
In Railway dashboard > Variables, add:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your anon key
- `SUPABASE_SERVICE_KEY`: Your service role key
- `DATABASE_URL`: Your Supabase database URL
- `SECRET_KEY`: Generate a secure key
- `ENVIRONMENT`: `production`
- `ALLOWED_ORIGINS`: Your Vercel frontend URL

### **2.4 Test Backend**
Once deployed, test your API:
- `https://your-app.railway.app/docs` (FastAPI docs)
- `https://your-app.railway.app/health` (health check)

---

## 🌐 **Step 3: Frontend Deployment (Vercel)**

### **3.1 Prepare Frontend**
1. Create `.env.local` in frontend folder:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
   NODE_ENV=production
   ```

2. Test locally:
   ```bash
   cd frontend
   npm install
   npm run build
   npm start
   ```

### **3.2 Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com)
2. Connect GitHub account
3. Import your repository
4. **Important**: Set root directory to `/frontend`
5. Add environment variables in Vercel dashboard
6. Deploy!

---

## 🔧 **Step 4: Configuration & Testing**

### **4.1 Update CORS**
In your Railway backend environment, update:
```env
ALLOWED_ORIGINS=https://your-actual-vercel-app.vercel.app
```

### **4.2 Test Full Stack**
1. Visit your Vercel frontend URL
2. Create a test account
3. Upload a sample collection CSV
4. Generate a deck
5. Export the deck

### **4.3 Verify Database**
Check Supabase dashboard > Table Editor to see:
- Users table has your test user
- Collections table has your uploaded collection
- User_settings table has default settings

---

## 🚀 **Step 5: Production Optimizations**

### **5.1 Supabase Optimizations**
- Enable **Row Level Security** (RLS) policies are already set
- Set up **Database backups** in Supabase dashboard
- Monitor **API usage** to stay within free tier

### **5.2 Railway Optimizations**
- Monitor memory usage (512MB free tier)
- Set up health checks
- Enable auto-sleep to save resources

### **5.3 Vercel Optimizations**
- Verify build performance
- Set up custom domain if desired
- Monitor bandwidth usage

---

## 🛠️ **Development Workflow**

### **Local Development**
1. Use local `.env` files pointing to your Supabase database
2. Run backend: `cd backend && python main.py`
3. Run frontend: `cd frontend && npm run dev`

### **Deployment**
1. Push to GitHub
2. Railway auto-deploys backend changes
3. Vercel auto-deploys frontend changes
4. Test in production

---

## 🔍 **Troubleshooting**

### **Common Issues**

**Backend won't start:**
- Check Railway logs for errors
- Verify all environment variables are set
- Test database connection

**Database connection fails:**
- Double-check DATABASE_URL format
- Verify Supabase is running
- Check firewall/security settings

**Frontend API calls fail:**
- Verify CORS origins in backend
- Check NEXT_PUBLIC_API_URL is correct
- Inspect browser network tab

**Authentication issues:**
- Verify SECRET_KEY is the same across deployments
- Check JWT token expiration
- Validate user exists in database

### **Useful Commands**
```bash
# Test database connection
psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"

# Check backend logs
railway logs

# Test API endpoint
curl https://your-backend.railway.app/health
```

---

## 📊 **Free Tier Limits**

### **Supabase Free Tier**
- 500MB database storage
- 2GB bandwidth/month
- 50,000 monthly active users
- Perfect for development and small apps

### **Railway Free Tier**
- 512MB RAM
- 1GB disk
- $5 monthly credit
- Auto-sleep after 30min inactivity

### **Vercel Free Tier**
- 100GB bandwidth/month
- Unlimited sites
- Auto-scaling
- Perfect for frontend hosting

---

## 🎯 **Success Checklist**

- ✅ Supabase project created with all tables
- ✅ Backend deployed on Railway
- ✅ Frontend deployed on Vercel
- ✅ Environment variables configured
- ✅ CORS origins updated
- ✅ Database connection working
- ✅ User registration/login working
- ✅ Collection upload working
- ✅ Deck generation working
- ✅ Export functionality working

**🎉 Your MTG Deck Optimizer is now live on Supabase!**
