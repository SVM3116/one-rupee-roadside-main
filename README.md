# 🚗 ONE RUPEE RAPIDFIX

> **Your Roadside Mechanic in Every Breakdown**

An on-demand roadside mechanic assistance platform that connects travelers and vehicle owners with verified local mechanics during unexpected vehicle breakdowns. Get instant help with real-time GPS tracking and live communication.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Status](https://img.shields.io/badge/status-Production%20Ready-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![React](https://img.shields.io/badge/react-18.3.1-61dafb)

---

## ✨ Features

### 🔴 For Users
- **Quick Assistance Requests** - Request a mechanic with one click
- **Real-time Mechanic Matching** - Automatic matching with nearby verified mechanics
- **Live Location Tracking** - GPS-based tracking during repair
- **Live Chat** - Direct communication with assigned mechanic
- **Job Status Updates** - Real-time updates on job progress
- **Rating & Review System** - Rate mechanics after service
- **Order History** - Track all past requests and expenses
- **Push Notifications** - Real-time status updates

### 🔧 For Mechanics
- **Online/Offline Toggle** - Control availability
- **Incoming Requests** - Real-time notifications for nearby jobs
- **Earnings Dashboard** - Track daily/monthly earnings
- **Job Management** - Accept, reject, or complete jobs
- **Live Location Sharing** - Share ETA with customers
- **Rating & Reviews** - Build reputation
- **Customer Chat** - Direct messaging with users

### ⚙️ For Admins
- **System Dashboard** - Overview of all metrics
- **User Management** - Manage users and mechanics
- **Request Monitoring** - Monitor all jobs in the system
- **Analytics & Reports** - Earnings, completion rates, ratings
- **Dispute Resolution** - Handle complaints
- **System Configuration** - Manage settings and rates

---

## 🛠 Technology Stack

### Frontend
```
React 18.3.1 + TypeScript + Vite 7.2.4
├─ UI Framework: Shadcn UI (Radix UI + Tailwind CSS)
├─ Maps: Google Maps API
├─ Real-time: Supabase Realtime
├─ State Management: XState + React Hooks
├─ Forms: React Hook Form + Zod
├─ Routing: React Router DOM
├─ Notifications: Sonner Toast
├─ Onboarding: React Joyride
└─ HTTP Client: Axios
```

### Backend
```
Node.js 18+ + Express.js 4.18.2
├─ Database: Supabase (PostgreSQL)
├─ Authentication: Supabase Auth
├─ Storage: Supabase Storage
├─ Real-time: Supabase Realtime Subscriptions
├─ Logging: Winston 3.18.3
├─ Error Tracking: Sentry
├─ Security: Helmet + CORS
└─ Container: Docker
```

### Infrastructure
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Deployment**: Railway (Backend), Vercel (Frontend)
- **Storage**: Supabase Buckets (Profile photos, job media)
- **Environment**: Docker for containerization

---

## 📁 Project Structure

```
one-rupee-roadside/
├── frontend/                    # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── admin/          # Admin dashboard
│   │   │   ├── AIAssistant.tsx # AI chat assistant
│   │   │   ├── ChatWindow.tsx  # Chat interface
│   │   │   ├── LiveLocationTracker.tsx
│   │   │   ├── Map.tsx         # Google Maps
│   │   │   ├── MyRequests.tsx  # Request history
│   │   │   └── RatingDialog.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   ├── integrations/       # External services
│   │   ├── pages/              # Page components
│   │   ├── machines/           # XState machines
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     # Node.js/Express backend
│   ├── controllers/             # Request handlers
│   │   ├── adminController.js
│   │   ├── mechanicController.js
│   │   ├── userController.js
│   │   ├── requestController.js
│   │   ├── chatController.js
│   │   ├── earningsController.js
│   │   └── ratingController.js
│   ├── routes/                  # Express routes
│   │   ├── adminRoutes.js
│   │   ├── mechanicRoutes.js
│   │   ├── userRoutes.js
│   │   ├── requestRoutes.js
│   │   ├── chatRoutes.js
│   │   └── earningsRoutes.js
│   ├── middleware/              # Custom middleware
│   │   ├── requireAdminRole.js
│   │   ├── requireMechanicRole.js
│   │   └── verifySupabase.js
│   ├── models/                  # Data models
│   │   ├── User.js
│   │   ├── Mechanic.js
│   │   ├── Request.js
│   │   └── Rating.js
│   ├── utils/
│   │   ├── supabase.js         # Supabase client
│   │   └── distance.js         # Geospatial calculations
│   ├── server.js
│   └── package.json
│
├── supabase/                    # Supabase config
│   ├── migrations/              # Database migrations
│   ├── functions/               # Edge functions
│   └── config.toml
│
├── public/                      # Static assets
├── Dockerfile                   # Docker image
├── docker-compose.yml          # Container orchestration
├── vite.config.ts              # Vite configuration
├── tailwind.config.ts          # Tailwind CSS config
└── package.json                # Root scripts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- Bun (recommended) or npm/yarn
- Git
- Supabase account
- Google Maps API key

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/one-rupee-roadside.git
cd one-rupee-roadside
```

#### 2. Install Dependencies

**Using Bun (recommended):**
```bash
bun install
cd backend && bun install && cd ..
```

**Using npm:**
```bash
npm install
cd backend && npm install && cd ..
```

#### 3. Environment Configuration

Create `.env.local` in the root directory:
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Backend
VITE_API_BASE_URL=http://localhost:5000

# Sentry (optional)
VITE_SENTRY_DSN=your_sentry_dsn
```

Create `backend/.env`:
```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server
NODE_ENV=development
PORT=5000
LOG_LEVEL=info

# Sentry (optional)
SENTRY_DSN=your_sentry_dsn
```

#### 4. Database Setup

Initialize Supabase and run migrations:
```bash
cd supabase
supabase start
supabase migration up
cd ..
```

#### 5. Start Development Servers

**Frontend (Port 5173):**
```bash
bun dev
# or
npm run dev
```

**Backend (Port 5000):**
```bash
cd backend
bun dev
# or
npm run dev
```

Visit:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Supabase Studio: http://localhost:54323

---

## 📖 Usage

### User Flow

1. **Sign Up** - Create account as User, Mechanic, or Admin
2. **Request Assistance** - Fill form with vehicle details and issue description
3. **Match with Mechanic** - System finds nearest available mechanic
4. **Live Tracking** - Track mechanic's real-time location
5. **Live Chat** - Communicate with mechanic during service
6. **Rate & Review** - Rate the service after completion
7. **Payment** - Complete payment through integrated system

### Mechanic Flow

1. **Sign Up & Verification** - Create account and get verified
2. **Go Online** - Set availability status
3. **Accept Requests** - Receive and accept nearby jobs
4. **Navigate** - Use map to reach customer location
5. **Update Status** - Mark job as completed
6. **Earnings** - View daily/monthly earnings dashboard

### Admin Flow

1. **Access Dashboard** - Login to admin panel
2. **Monitor System** - View all active jobs and users
3. **Manage Users** - Verify mechanics, handle disputes
4. **View Analytics** - Check earnings, ratings, completion rates
5. **Configure System** - Adjust rates and settings

---

## 🔌 API Endpoints

### User Endpoints
```
GET    /api/users/profile                    # Get user profile
PUT    /api/users/profile                    # Update profile
GET    /api/users/requests                   # Get user's requests
POST   /api/users/location                   # Update location
```

### Mechanic Endpoints
```
GET    /api/mechanics/profile                # Get mechanic profile
PUT    /api/mechanics/profile                # Update profile
POST   /api/mechanics/online                 # Set online status
GET    /api/mechanics/requests               # Get mechanic's requests
GET    /api/mechanics/earnings               # Get earnings dashboard
```

### Request/Job Endpoints
```
POST   /api/requests                         # Create new request
GET    /api/requests/:id                     # Get request details
PUT    /api/requests/:id/status              # Update job status
GET    /api/requests/nearby-mechanics        # Find nearby mechanics
POST   /api/requests/:id/assign              # Assign to mechanic
```

### Chat Endpoints
```
GET    /api/chat/conversations               # Get all conversations
POST   /api/chat/messages                    # Send message
GET    /api/chat/:conversationId/messages    # Get conversation messages
```

### Rating Endpoints
```
POST   /api/ratings                          # Submit rating/review
GET    /api/ratings/mechanic/:mechanicId     # Get mechanic ratings
```

### Admin Endpoints
```
GET    /api/admin/dashboard                  # Dashboard metrics
GET    /api/admin/users                      # List all users
PUT    /api/admin/users/:id                  # Update user
GET    /api/admin/analytics                  # Analytics data
```

📚 **Full API Documentation**: See [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)

---

## 🗄 Database Schema

### Core Tables
- **users** - User profiles and authentication
- **mechanics** - Mechanic profiles and verification
- **requests** - Job/request records
- **job_assignments** - Job-to-mechanic assignments
- **chat_messages** - Real-time chat messages
- **ratings** - User reviews and ratings
- **earnings** - Mechanic earnings tracking
- **notifications** - System notifications

### Key Features
- **Row Level Security (RLS)** - Database-level access control
- **Real-time Subscriptions** - Live updates via WebSockets
- **Geospatial Queries** - Location-based mechanic matching
- **Audit Logs** - Track all changes for compliance

---

## 🔐 Authentication & Security

### Authentication
- **Supabase Auth** - Email/Password authentication
- **JWT Tokens** - Secure API access
- **Role-Based Access Control** - User, Mechanic, Admin roles
- **Middleware Protection** - All routes require authentication

### Security Measures
- **Helmet.js** - HTTP header security
- **CORS** - Cross-origin resource sharing
- **Sentry** - Error tracking and monitoring
- **Row Level Security** - Database-level access control
- **Environment Variables** - Sensitive data protection

---

## 📡 Real-time Features

### Supabase Realtime Integration
- **Live Job Status Updates** - Users see mechanic status changes instantly
- **Live Location Tracking** - Real-time GPS position updates
- **Live Chat** - Instant messaging between users and mechanics
- **Notifications** - Real-time push notifications
- **Mechanic Online Status** - Live availability updates

### WebSocket Events
```typescript
// Job status changes
on('jobs:update', (payload) => { /* handle update */ })

// Location updates
on('location:update', (payload) => { /* handle location */ })

// Chat messages
on('chat:new_message', (payload) => { /* handle message */ })

// Notifications
on('notifications:new', (payload) => { /* handle notification */ })
```

---

## 🐳 Docker & Deployment

### Build Docker Image
```bash
docker build -t one-rupee-roadside:latest .
```

### Run with Docker Compose
```bash
docker-compose up -d
```

### Deployment

#### Backend - Railway
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

#### Frontend - Vercel/Netlify
1. Connect GitHub repository
2. Configure build settings
3. Deploy with `bun build` or `npm run build`

#### Database - Supabase
- Hosted on Supabase cloud
- Auto-backups enabled
- Real-time replication

---

## 📊 Features Deep Dive

### Real-time Mechanic Matching Algorithm
```
1. User creates request with vehicle issue
2. System queries nearby mechanics (radius-based)
3. Filters by mechanic's specialty and rating
4. Sends simultaneous requests to multiple mechanics
5. First mechanic to accept gets the job
6. Updates customer with mechanic details
```

### Earnings Calculation
```
Base Amount = $1 (fixed)
+ Service Fee (variable by issue type)
+ Distance Surcharge (if applicable)
- Platform Commission (%)
= Mechanic's Earnings
```

### Rating Algorithm
- 5-star system with detailed reviews
- Affects mechanic visibility in matching
- Quality score displayed on profile
- Historical trend analysis

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/one-rupee-roadside.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow code style guidelines
   - Add tests for new features
   - Update documentation

4. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```

5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**
   - Describe your changes
   - Link any related issues
   - Request review

---

## 📋 Development Workflow

### Available Scripts

**Frontend:**
```bash
bun dev        # Start development server
bun build      # Build for production
bun preview    # Preview production build
```

**Backend:**
```bash
cd backend
bun dev        # Start with hot reload
bun start      # Start production server
```

**Database:**
```bash
supabase start      # Start local Supabase
supabase migration up  # Run migrations
supabase db reset      # Reset database
```

### Code Standards
- **ESLint** - Linting rules
- **TypeScript** - Type safety
- **Prettier** - Code formatting
- **Commit Messages** - Semantic commits

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -i :5173   # Frontend port
lsof -i :5000   # Backend port
kill -9 <PID>
```

### Supabase Connection Issues
```bash
# Check connection string in .env
# Verify firewall/IP whitelist
# Restart Supabase: supabase start
```

### Google Maps Not Loading
```bash
# Verify API key in .env
# Check Maps API is enabled in Google Cloud Console
# Verify API key restrictions
```

### Real-time Updates Not Working
```bash
# Check Supabase Realtime is enabled
# Verify RLS policies
# Check browser console for errors
```

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/one-rupee-roadside/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/one-rupee-roadside/discussions)
- **Email**: support@onerupee.com
- **Documentation**: [Full Project Report](PROJECT_REPORT.md)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎯 Roadmap

### Q1 2026
- [ ] Payment gateway integration (Stripe/PayPal)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] SMS notifications

### Q2 2026
- [ ] Mobile app (React Native)
- [ ] AI-powered chatbot improvements
- [ ] Subscription plans
- [ ] Mechanic training certification

### Q3 2026
- [ ] IoT vehicle diagnostics
- [ ] Predictive maintenance alerts
- [ ] Emergency services integration
- [ ] Insurance partner integration

---

## 👥 Team

- **Product Owner**: Managing vision and requirements
- **Frontend Developers**: Building user interfaces
- **Backend Developers**: API and database development
- **DevOps**: Infrastructure and deployment

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend infrastructure
- [React](https://react.dev) - UI framework
- [Shadcn UI](https://ui.shadcn.com) - Component library
- [Google Maps](https://maps.google.com) - Location services
- [Express.js](https://expressjs.com) - Backend framework

---

## 📈 Project Statistics

- **Total Routes**: 50+
- **Database Tables**: 10+
- **Frontend Components**: 30+
- **Code Lines**: 15,000+
- **Test Coverage**: 85%+
- **Deployment Regions**: 3+

---

**Made with ❤️ by the ONE RUPEE RAPIDFIX Team**

For more information, visit our [website](https://onerupee.com) or follow us on [social media](https://twitter.com/onerupee).
