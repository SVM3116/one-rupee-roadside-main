# 🚀 ONE RUPEE RAPIDFIX - Roadside Mechanic Assistance System

A web-based platform that connects users facing vehicle breakdowns with nearby verified mechanics in real-time.

## ✨ Features

- 🔐 Multi-role authentication (User, Mechanic, Admin)
- 📍 GPS-based location detection
- 🟢 Real-time mechanic availability toggle
- 🎯 Automatic job assignment to nearest mechanic (within 50km)
- 📊 Live location tracking on admin dashboard
- ✅ Document verification for mechanics
- ⭐ Rating and review system
- 📱 Fully responsive design

## 🛠️ Tech Stack

### Frontend
- React.js (Vite)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Google Maps API
- Supabase (Auth & Realtime)

### Backend
- Node.js
- Express.js
- MongoDB Atlas
- JWT Authentication

### Database
- MongoDB (Backend data)
- Supabase PostgreSQL (Auth, profiles, locations, jobs)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Supabase account
- Google Maps API key

### Installation

1. **Clone repository**
```bash
git clone https://github.com/SVM3116/one-rupee-roadside-main.git
cd one-rupee-roadside-main
```

2. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

3. **Environment Variables**

Create `.env` in root:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_API_BASE=http://localhost:5000
```

Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
JWT_SECRET=your_jwt_secret
```

4. **Run Supabase Migrations**
- Go to Supabase SQL Editor
- Run SQL files from `supabase/migrations/` folder

5. **Start Development Servers**
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend (with HTTPS)
npm run dev:https
```

## 🌐 Deployment

See `START_DEPLOYMENT.md` for detailed deployment instructions.

**Recommended Platforms:**
- Frontend: Vercel
- Backend: Railway or Render

## 📚 Documentation

- `HOW_TO_UPLOAD_TO_GITHUB.md` - Upload project to GitHub
- `START_DEPLOYMENT.md` - Deploy to internet
- `backend/API_DOCUMENTATION.md` - API reference

## 📄 License

This project is private/proprietary.

---

**Built with ❤️ for roadside assistance**
