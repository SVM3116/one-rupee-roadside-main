# ONE RUPEE RAPIDFIX - Complete Project Report

**Generated:** November 24, 2025  
**Version:** 2.0.0  
**Project Status:** Production Ready

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Features Implemented](#features-implemented)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Structure](#frontend-structure)
8. [Backend Structure](#backend-structure)
9. [Authentication & Authorization](#authentication--authorization)
10. [Real-time Features](#real-time-features)
11. [Deployment Configuration](#deployment-configuration)
12. [Environment Variables](#environment-variables)
13. [Setup Instructions](#setup-instructions)
14. [Recent Updates & Fixes](#recent-updates--fixes)

---

## 🎯 Project Overview

**ONE RUPEE RAPIDFIX** is a comprehensive on-demand roadside mechanic assistance platform that connects travelers and vehicle owners with verified local mechanics during unexpected vehicle breakdowns. The system uses real-time GPS tracking, automatic mechanic matching, and live communication features to provide fast, reliable, and affordable roadside assistance.

### Key Objectives
- Instant connection between users and nearby verified mechanics
- Real-time GPS-based location tracking
- Automatic mechanic matching based on proximity
- Live chat communication between users and mechanics
- Comprehensive admin dashboard for system management
- Rating and review system for quality assurance

---

## 🛠 Technology Stack

### Frontend
- **Framework:** React 18.3.1 with TypeScript
- **Build Tool:** Vite 7.2.4
- **Routing:** React Router DOM 6.30.1
- **UI Library:** 
  - Shadcn UI (Radix UI components)
  - Tailwind CSS 3.4.17
  - Lucide React (Icons)
- **State Management:**
  - XState 5.24.0 (Job Status Machine)
  - React Hooks (useState, useEffect, useCallback)
- **Maps:** Google Maps JavaScript API (@react-google-maps/api)
- **Real-time:** Supabase Realtime
- **Notifications:** Sonner (Toast notifications)
- **Forms:** React Hook Form with Zod validation
- **Onboarding:** React Joyride 2.9.3

### Backend
- **Runtime:** Node.js 18+ (Alpine Linux)
- **Framework:** Express.js 4.18.2
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (Profile photos, job media)
- **Logging:** Winston 3.18.3
- **Error Tracking:** Sentry (@sentry/node)
- **Security:** Helmet, CORS
- **API Client:** Axios 1.4.0

### Database & Infrastructure
- **Database:** Supabase PostgreSQL
- **Real-time:** Supabase Realtime Subscriptions
- **Storage:** Supabase Storage Buckets
- **Deployment:** Railway (Backend), Vercel/Netlify (Frontend)
- **Container:** Docker

---

## 🏗 Architecture

### System Architecture
```
┌─────────────────┐
│   Frontend      │  React + TypeScript + Vite
│   (Port 8080)   │  └─ User Dashboard
│                 │  └─ Mechanic Dashboard
│                 │  └─ Admin Dashboard
└────────┬────────┘
         │ HTTPS
         │
┌────────▼────────┐
│   Backend API   │  Express.js + Node.js
│   (Port 5000)   │  └─ RESTful API
│                 │  └─ Authentication Middleware
└────────┬────────┘
         │
┌────────▼────────┐
│   Supabase     │  PostgreSQL + Realtime
│   Database     │  └─ Row Level Security (RLS)
│   + Storage    │  └─ Real-time Subscriptions
└────────────────┘
```

### User Roles
1. **Traveler/User:** Request roadside assistance, track mechanics, rate services
2. **Mechanic:** Accept jobs, update status, share location, communicate with users
3. **Admin:** Manage users, mechanics, job requests, view analytics

---

## ✨ Features Implemented

### User Features
- ✅ User registration and authentication
- ✅ Request roadside assistance with vehicle details
- ✅ Automatic mechanic matching based on proximity
- ✅ Real-time mechanic location tracking
- ✅ Job status tracking (pending → accepted → on_the_way → reached → repair_started → repair_completed → completed)
- ✅ Live chat with mechanics
- ✅ Real-time chat notifications
- ✅ View job history
- ✅ Rate and review mechanics
- ✅ User profile management
- ✅ Onboarding tour for new users

### Mechanic Features
- ✅ Mechanic registration and verification
- ✅ Online/Offline status toggle
- ✅ Real-time location sharing
- ✅ Accept/reject job requests
- ✅ Dynamic job request notifications
- ✅ Job status management (XState machine)
- ✅ Navigate to customer location
- ✅ Live chat with users
- ✅ Earnings tracking
- ✅ Mechanic profile management

### Admin Features
- ✅ Admin dashboard with analytics
- ✅ User management
- ✅ Mechanic management and verification
- ✅ Job requests management
- ✅ Manual job assignment (online mechanics only)
- ✅ Live tracking of all mechanics
- ✅ Mechanic heatmap visualization
- ✅ Breakdown location heatmap (analytics)
- ✅ Export job requests to CSV
- ✅ Filter and search capabilities

### System Features
- ✅ Automatic sign-out on tab close (sessionStorage)
- ✅ Persistent login on page refresh
- ✅ Real-time updates without page refresh
- ✅ Google Maps integration
- ✅ Service Worker for offline support
- ✅ Push notifications support
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Dark/Light theme support

---

## 🗄 Database Schema

### Core Tables

#### `profiles`
- `id` (UUID, Primary Key, references auth.users)
- `email` (TEXT)
- `full_name` (TEXT)
- `phone` (TEXT)
- `role` (app_role enum: 'admin', 'mechanic', 'user')
- `status` (TEXT, default: 'active')
- `availability_status` (TEXT, default: 'offline')
- `verification_status` (TEXT: 'pending', 'approved', 'rejected')
- `profile_photo` (TEXT, URL)
- `services` (TEXT[])
- `work_location` (TEXT)
- `pincode` (TEXT)
- `bank_account_number`, `bank_ifsc`, `bank_name`, `bank_branch` (TEXT)
- `documents` (JSONB)
- `onboarding_completed` (BOOLEAN, default: false)
- `created_at`, `updated_at` (TIMESTAMP)

#### `user_roles`
- `id` (UUID, Primary Key)
- `user_id` (UUID, references auth.users)
- `role` (app_role enum)
- Unique constraint on (user_id, role)

#### `job_requests`
- `id` (UUID, Primary Key)
- `user_id` (UUID, references auth.users)
- `mechanic_id` (UUID, nullable, references auth.users)
- `status` (TEXT: 'pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed', 'completed', 'cancelled', 'rejected')
- `user_location` (JSONB: {lat, lng})
- `issue_description` (TEXT)
- `vehicle_type` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

#### `mechanic_locations`
- `id` (UUID, Primary Key)
- `mechanic_id` (UUID, Unique, references auth.users)
- `latitude` (DECIMAL 10,8)
- `longitude` (DECIMAL 11,8)
- `updated_at` (TIMESTAMP)

#### `chat_messages`
- `id` (UUID, Primary Key)
- `request_id` (UUID, references job_requests)
- `sender_id` (UUID, references auth.users)
- `sender_type` (TEXT: 'user' or 'mechanic')
- `message` (TEXT)
- `read_at` (TIMESTAMP, nullable)
- `created_at` (TIMESTAMP)

#### `testimonials` (Ratings)
- `id` (UUID, Primary Key)
- `user_id` (UUID, references auth.users)
- `mechanic_id` (UUID, references auth.users)
- `rating` (INTEGER, 1-5)
- `comment` (TEXT, nullable)
- `created_at`, `updated_at` (TIMESTAMP)

#### `earnings`
- `id` (UUID, Primary Key)
- `mechanic_id` (UUID, references auth.users)
- `job_request_id` (UUID, references job_requests)
- `amount` (DECIMAL)
- `status` (TEXT: 'pending', 'paid')
- `created_at`, `updated_at` (TIMESTAMP)

### Storage Buckets
- `profile-photos`: User and mechanic profile pictures
- `job-media`: Photos/videos related to job requests

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies ensure users can only access their own data
- Admins have full access
- Mechanics can view jobs assigned to them

---

## 🔌 API Endpoints

### Base URL
- **Development:** `http://localhost:5000`
- **Production:** Set via `VITE_API_BASE` environment variable

### User Endpoints (`/api/user`)
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `GET /requests` - Get user's job requests
- `GET /requests/:id` - Get specific job request

### Mechanic Endpoints (`/api/mechanic`)
- `GET /online-status/:id` - Get mechanic online status
- `PUT /toggle-online` - Toggle online/offline status
- `PUT /location` - Update mechanic location
- `GET /nearby` - Find nearby mechanics
- `GET /jobs` - Get mechanic's assigned jobs
- `POST /accept/:requestId` - Accept a job request
- `POST /reject/:requestId` - Reject a job request

### Request Endpoints (`/api/requests`)
- `POST /` - Create new job request
- `GET /:id` - Get job request details
- `PUT /:id/status` - Update job status
- `GET /` - List all job requests (admin)

### Rating Endpoints (`/api/ratings`)
- `POST /` - Submit rating/review
- `GET /mechanic/:mechanicId` - Get mechanic ratings

### Admin Endpoints (`/api/admin`)
- `GET /users` - List all users
- `GET /mechanics` - List all mechanics
- `GET /jobs` - List all job requests
- `PUT /verify-mechanic/:id` - Verify/reject mechanic
- `GET /analytics` - Get analytics data

### Chat Endpoints (`/api/chat`)
- `GET /messages/:requestId` - Get chat messages
- `POST /messages` - Send message
- `PUT /messages/:id/read` - Mark message as read

### Notification Endpoints (`/api/notifications`)
- `GET /` - Get user notifications
- `PUT /:id/read` - Mark notification as read

### Earnings Endpoints (`/api/earnings`)
- `GET /mechanic/:mechanicId` - Get mechanic earnings

### Health Check
- `GET /` - Server health and endpoint list

---

## 📁 Frontend Structure

```
src/
├── pages/
│   ├── Home.tsx                 # Landing page
│   ├── Auth.tsx                 # Login/Signup
│   ├── Dashboard.tsx            # User dashboard
│   ├── MechanicDashboard.tsx    # Mechanic dashboard
│   ├── Admin.tsx                # Admin dashboard
│   ├── About.tsx                # About page
│   ├── Services.tsx             # Services page
│   ├── Contact.tsx              # Contact page
│   ├── UserProfile.tsx          # User profile
│   ├── MechanicProfile.tsx      # Mechanic profile
│   └── NotFound.tsx             # 404 page
│
├── components/
│   ├── admin/
│   │   ├── AnalyticsTab.tsx      # Analytics dashboard
│   │   ├── JobRequestsTab.tsx    # Job management
│   │   ├── LiveTrackingTab.tsx   # Live mechanic tracking
│   │   ├── MechanicsTab.tsx     # Mechanic management
│   │   └── UsersTab.tsx          # User management
│   │
│   ├── ui/                      # Shadcn UI components
│   │
│   ├── RequestAssistanceForm.tsx # Job request form
│   ├── MyRequests.tsx            # User job history
│   ├── TrackingPanel.tsx         # Job status tracking
│   ├── Map.tsx                   # Google Maps component
│   ├── LiveLocationTracker.tsx   # Real-time location
│   ├── MechanicOnlineToggle.tsx  # Online/offline toggle
│   ├── JobStatusManager.tsx     # XState job status
│   ├── ChatButton.tsx            # Chat trigger
│   ├── ChatWindow.tsx            # Chat interface
│   ├── ChatNotificationBadge.tsx # Chat notifications
│   ├── OnboardingTour.tsx        # User onboarding
│   ├── RatingDialog.tsx          # Rating component
│   ├── NotificationBell.tsx      # Notifications
│   ├── Navbar.tsx                # Navigation
│   └── Footer.tsx                # Footer
│
├── hooks/
│   ├── useChatNotifications.ts   # Chat notification hook
│   ├── useJobStatusMachine.ts   # XState integration
│   └── use-toast.ts              # Toast notifications
│
├── machines/
│   └── jobStatusMachine.ts      # XState state machine
│
├── integrations/
│   └── supabase/
│       ├── client.ts            # Supabase client
│       └── types.ts             # TypeScript types
│
├── lib/
│   ├── api.ts                   # Axios configuration
│   └── utils.ts                 # Utility functions
│
└── utils/
    ├── geolocation.ts           # GPS utilities
    ├── notifications.ts          # Push notifications
    └── eta.ts                   # ETA calculations
```

---

## 🔧 Backend Structure

```
backend/
├── server.js                    # Express server entry point
│
├── controllers/
│   ├── userController.js       # User operations
│   ├── mechanicController.js    # Mechanic operations
│   ├── requestController.js     # Job request operations
│   ├── ratingController.js      # Rating operations
│   ├── adminController.js       # Admin operations
│   ├── chatController.js        # Chat operations
│   ├── notificationController.js # Notification operations
│   └── earningsController.js    # Earnings operations
│
├── routes/
│   ├── userRoutes.js
│   ├── mechanicRoutes.js
│   ├── requestRoutes.js
│   ├── ratingRoutes.js
│   ├── adminRoutes.js
│   ├── chatRoutes.js
│   ├── notificationRoutes.js
│   └── earningsRoutes.js
│
├── middleware/
│   ├── verifySupabase.js        # Supabase auth verification
│   ├── requireUserRole.js       # User role check
│   ├── requireMechanicRole.js  # Mechanic role check
│   └── requireAdminRole.js      # Admin role check
│
├── models/
│   ├── User.js                  # User model (Mongoose - legacy)
│   ├── Mechanic.js              # Mechanic model (Mongoose - legacy)
│   ├── Request.js               # Request model (Mongoose - legacy)
│   └── Rating.js                # Rating model (Mongoose - legacy)
│
├── utils/
│   ├── supabase.js              # Supabase client
│   └── distance.js              # Distance calculations
│
└── package.json
```

---

## 🔐 Authentication & Authorization

### Authentication Flow
1. User signs up/signs in via Supabase Auth
2. Session stored in `sessionStorage` (clears on tab close)
3. JWT token included in API requests
4. Backend verifies token via Supabase

### Authorization
- **Role-based access control (RBAC)** via `user_roles` table
- **Row Level Security (RLS)** in Supabase
- **Middleware** checks user roles before API access

### Session Management
- Uses `sessionStorage` (not `localStorage`)
- Automatically signs out when tab closes
- Persists login on page refresh
- Signs out when browser cache is cleared

---

## 🔴 Real-time Features

### Supabase Realtime Subscriptions
1. **Job Requests:** Real-time updates when jobs are assigned/updated
2. **Chat Messages:** Instant message delivery
3. **Mechanic Locations:** Live location updates
4. **Notifications:** Real-time notification delivery

### Implementation
- Frontend subscribes to Supabase channels
- Backend triggers database changes
- Real-time events propagate to connected clients
- Optimistic UI updates for better UX

---

## 🚀 Deployment Configuration

### Railway (Backend)
- **Dockerfile:** Node.js 18-alpine based
- **Configuration:** `railway.json`
- **Port:** Set via `PORT` environment variable
- **Health Check:** `GET /`

### Frontend Deployment
- **Build Command:** `npm run build`
- **Output:** `dist/` directory
- **Deploy:** Vercel, Netlify, or any static host

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
EXPOSE 5000
CMD ["npm", "start"]
```

---

## 🔑 Environment Variables

### Frontend (`.env`)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_API_BASE=http://localhost:5000
```

### Backend (`.env` in `backend/` directory)
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server
PORT=5000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Optional
SENTRY_DSN=your_sentry_dsn
OPENAI_API_KEY=your_openai_key (if using AI features)
```

### Railway Environment Variables
Set these in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (auto-set by Railway)
- `NODE_ENV=production`
- `ALLOWED_ORIGINS`

---

## 📝 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Maps API key
- Railway account (for backend deployment)

### Local Development Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd one-rupee-roadside-main
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Set Up Environment Variables**
   - Create `.env` in root directory (frontend)
   - Create `.env` in `backend/` directory (backend)

5. **Run Database Migrations**
   - Go to Supabase Dashboard → SQL Editor
   - Run all migration files from `supabase/migrations/`

6. **Start Development Servers**
   ```bash
   # Frontend (Terminal 1)
   npm run dev

   # Backend (Terminal 2)
   cd backend
   npm run dev
   ```

7. **Access Application**
   - Frontend: `http://localhost:8080`
   - Backend: `http://localhost:5000`

### Production Deployment

1. **Backend (Railway)**
   - Connect GitHub repository
   - Railway auto-detects Dockerfile
   - Set environment variables
   - Deploy

2. **Frontend (Vercel/Netlify)**
   - Connect GitHub repository
   - Set build command: `npm run build`
   - Set output directory: `dist`
   - Set environment variables
   - Deploy

3. **Supabase**
   - Run all migrations
   - Enable Realtime for `chat_messages` table
   - Set up storage buckets
   - Configure RLS policies

---

## 🔄 Recent Updates & Fixes

### Latest Changes (November 2025)

1. **Manual Job Assignment (Admin)**
   - Added dropdown to assign jobs to online mechanics
   - Only shows mechanics who are online and verified
   - Only available when system hasn't auto-assigned

2. **Footer Update**
   - Updated copyright year to 2025

3. **Auth Page Enhancement**
   - Added welcome message for traveller login
   - Improved UI for mechanic login

4. **Navbar Updates**
   - Changed "Login" to "Traveller Login"
   - Added border styling to match "Mechanic Login"

5. **About Page**
   - Removed separate "Tagline" section

6. **Docker Deployment**
   - Created Dockerfile for Railway deployment
   - Updated railway.json configuration
   - Added .dockerignore for optimized builds

### Previous Major Fixes

1. **Chat System**
   - Fixed blinking/dancing chat window
   - Implemented optimistic updates
   - Added real-time notifications
   - Fixed message disappearing issue
   - Improved chat scrolling

2. **Job Status Management**
   - Fixed status button functionality
   - Implemented XState machine
   - Corrected status transitions

3. **Location Sharing**
   - Fixed location sharing persistence after refresh
   - Auto-resume location sharing if mechanic was online

4. **Dynamic Updates**
   - Real-time job request notifications
   - Dynamic mechanic status updates
   - Active jobs count correction

5. **Onboarding**
   - Fixed onboarding tour showing for existing users
   - Only shows for truly new users

6. **Authentication**
   - Fixed automatic sign-out on refresh
   - Implemented proper session management

---

## 📊 Project Statistics

- **Total Components:** 80+ React components
- **API Endpoints:** 30+ REST endpoints
- **Database Tables:** 7 core tables
- **Real-time Subscriptions:** 4 active channels
- **User Roles:** 3 (User, Mechanic, Admin)
- **Job Status States:** 9 states
- **Migration Files:** 13 SQL migrations

---

## 🎯 Future Enhancements (Potential)

- [ ] Payment integration
- [ ] SMS notifications
- [ ] Push notifications (mobile)
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mechanic scheduling system
- [ ] Customer support chat
- [ ] Mobile apps (React Native)
- [ ] Advanced search and filters
- [ ] Job history export

---

## 📞 Support & Contact

- **Email:** support@onerupeerapidfix.com
- **Project:** ONE RUPEE RAPIDFIX
- **Version:** 2.0.0
- **Last Updated:** November 24, 2025

---

## 📄 License

© 2025 ONE RUPEE RAPIDFIX. All rights reserved.

---

**End of Report**

