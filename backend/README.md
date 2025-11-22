# ONE RUPEE Backend API

Complete REST API for the ONE RUPEE Roadside Mechanic Assistance System.

## Features

- ✅ User management (profile, location)
- ✅ Mechanic management (online status, location, requests)
- ✅ Request/Job management (create, accept, reject, update status)
- ✅ Ratings and reviews system
- ✅ Admin dashboard endpoints
- ✅ Geospatial queries for finding nearby mechanics
- ✅ Role-based authentication and authorization
- ✅ MongoDB integration with in-memory fallback for development

## Quick Start

### Prerequisites
- Node.js >= 16
- MongoDB Atlas account (optional for development)

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your credentials:
```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Main Endpoints

- **User API**: `/api/user/*`
- **Mechanic API**: `/api/mechanic/*`
- **Request API**: `/api/requests/*`
- **Rating API**: `/api/ratings/*`
- **Admin API**: `/api/admin/*`

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## Architecture

### Models
- `User` - User profiles and locations
- `Mechanic` - Mechanic profiles, online status, locations
- `Request` - Service requests/jobs
- `Rating` - Ratings and reviews

### Controllers
- `userController` - User operations
- `mechanicController` - Mechanic operations
- `requestController` - Request/job operations
- `ratingController` - Rating operations
- `adminController` - Admin operations

### Middleware
- `verifySupabase` - Verifies Supabase JWT tokens
- `requireUserRole` - Ensures user/traveler role
- `requireMechanicRole` - Ensures mechanic role
- `requireAdminRole` - Ensures admin role

### Routes
- `userRoutes` - User endpoints
- `mechanicRoutes` - Mechanic endpoints
- `requestRoutes` - Request endpoints
- `ratingRoutes` - Rating endpoints
- `adminRoutes` - Admin endpoints

## Development Mode

When `MONGODB_URI` is not set, the API runs in **in-memory mock mode**. This allows development without a MongoDB connection, but data is lost on server restart.

**Note:** In-memory mode is for development only. Always use MongoDB in production.

## Authentication

Most endpoints require authentication via Supabase JWT token:

```
Authorization: Bearer <supabase_access_token>
```

The middleware verifies the token and extracts user information, including role.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message"
}
```

Status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Geospatial Features

The API includes utilities for:
- Distance calculation (Haversine formula)
- Finding nearest mechanics within radius
- Auto-assignment of mechanics to requests

## Testing

You can test the API using:
- Postman
- curl
- Any HTTP client

Example health check:
```bash
curl http://localhost:5000/
```

Example ping:
```bash
curl http://localhost:5000/api/mechanic/ping
```

## Production Considerations

1. **Environment Variables**: Never commit `.env` file. Use environment variables or secrets management.
2. **MongoDB**: Always use MongoDB in production. In-memory mode is for development only.
3. **Security**: 
   - Enable HTTPS
   - Use strong CORS policies
   - Validate all inputs
   - Rate limiting recommended
4. **Performance**:
   - Add caching where appropriate
   - Use database indexes (already defined in models)
   - Consider connection pooling
5. **Monitoring**: Add logging and monitoring in production

## License

Part of the ONE RUPEE project.
