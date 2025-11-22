# ONE RUPEE Backend API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require authentication via Supabase JWT token:
```
Authorization: Bearer <supabase_access_token>
```

---

## User Endpoints

### GET /api/user/profile
Get current user's profile.

**Authentication:** Required (User/Traveler role)

**Response:**
```json
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "location": {
      "lat": 28.6139,
      "lng": 77.2090
    }
  }
}
```

### PUT /api/user/profile
Update user profile.

**Authentication:** Required (User/Traveler role)

**Body:**
```json
{
  "fullName": "John Doe",
  "phone": "+1234567890",
  "location": {
    "lat": 28.6139,
    "lng": 77.2090
  }
}
```

### PUT /api/user/location
Update user's current location.

**Authentication:** Required (User/Traveler role)

**Body:**
```json
{
  "lat": 28.6139,
  "lng": 77.2090
}
```

---

## Mechanic Endpoints

### POST /api/mechanic/toggle-online
Toggle mechanic's online/offline status.

**Authentication:** Required (Mechanic role)

**Body:**
```json
{
  "isOnline": true
}
```

### GET /api/mechanic/online-status/:id
Get mechanic's online status by ID (public).

**Response:**
```json
{
  "success": true,
  "status": {
    "isOnline": true,
    "availabilityStatus": "online",
    "updatedAt": "2025-01-20T10:00:00Z"
  }
}
```

### GET /api/mechanic/online-status
Get current mechanic's online status.

**Authentication:** Required

### PUT /api/mechanic/location
Update mechanic's current location.

**Authentication:** Required (Mechanic role)

**Body:**
```json
{
  "lat": 28.6139,
  "lng": 77.2090
}
```

### GET /api/mechanic/nearby
Find nearby online mechanics (public).

**Query Parameters:**
- `lat` (required): User latitude
- `lng` (required): User longitude
- `radius` (optional): Search radius in meters (default: 10000)

**Example:**
```
GET /api/mechanic/nearby?lat=28.6139&lng=77.2090&radius=5000
```

**Response:**
```json
{
  "success": true,
  "mechanics": [
    {
      "uid": "mechanic-id",
      "fullName": "Mechanic Name",
      "distance": 2500,
      "isOnline": true,
      "services": ["engine_repair", "battery_replacement"]
    }
  ]
}
```

### GET /api/mechanic/requests
Get mechanic's assigned requests.

**Authentication:** Required (Mechanic role)

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Limit results (default: 50)

---

## Request Endpoints

### POST /api/requests
Create a new service request.

**Authentication:** Required (User/Traveler role)

**Body:**
```json
{
  "vehicleType": "car",
  "issueDescription": "Engine won't start",
  "userLocation": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "mediaUrls": ["https://..."],
  "requestId": "optional-supabase-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "requestId": "req-123",
    "userId": "user-id",
    "mechanicId": "mechanic-id",
    "status": "pending",
    "vehicleType": "car",
    "issueDescription": "Engine won't start",
    "userLocation": {
      "lat": 28.6139,
      "lng": 77.2090
    },
    "createdAt": "2025-01-20T10:00:00Z"
  }
}
```

### GET /api/requests
Get user's requests.

**Authentication:** Required (User/Traveler role)

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Limit results (default: 50)

### GET /api/requests/:requestId
Get a specific request.

**Authentication:** Required (User or assigned Mechanic)

### PUT /api/requests/:requestId/accept
Accept a request (mechanic).

**Authentication:** Required (Mechanic role)

### PUT /api/requests/:requestId/reject
Reject a request (mechanic).

**Authentication:** Required (Mechanic role)

**Response:**
```json
{
  "success": true,
  "request": { ... },
  "reassigned": true
}
```

### PUT /api/requests/:requestId/status
Update request status.

**Authentication:** Required (User or assigned Mechanic)

**Body:**
```json
{
  "status": "in_progress"
}
```

**Valid statuses:** `pending`, `accepted`, `on_the_way`, `in_progress`, `completed`, `cancelled`

---

## Rating Endpoints

### POST /api/ratings
Create a rating/review.

**Authentication:** Required (User/Traveler role)

**Body:**
```json
{
  "mechanicId": "mechanic-id",
  "requestId": "request-id",
  "rating": 5,
  "comment": "Great service!",
  "ratingId": "optional-supabase-uuid"
}
```

### GET /api/ratings/mechanic/:mechanicId
Get ratings for a mechanic (public).

**Query Parameters:**
- `limit` (optional): Limit results (default: 50)

**Response:**
```json
{
  "success": true,
  "ratings": [
    {
      "ratingId": "rating-123",
      "userId": "user-id",
      "mechanicId": "mechanic-id",
      "rating": 5,
      "comment": "Great service!",
      "createdAt": "2025-01-20T10:00:00Z"
    }
  ],
  "stats": {
    "average": 4.5,
    "total": 10,
    "distribution": {
      "5": 6,
      "4": 3,
      "3": 1,
      "2": 0,
      "1": 0
    }
  }
}
```

### GET /api/ratings/user
Get user's ratings.

**Authentication:** Required (User/Traveler role)

### PUT /api/ratings/:ratingId
Update a rating.

**Authentication:** Required (User/Traveler role - owner only)

**Body:**
```json
{
  "rating": 4,
  "comment": "Updated comment"
}
```

---

## Admin Endpoints

### GET /api/admin/stats
Get system statistics.

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "stats": {
    "users": 150,
    "mechanics": 25,
    "requests": 500,
    "completedRequests": 450,
    "pendingRequests": 10,
    "ratings": 400,
    "averageRating": 4.5
  }
}
```

### GET /api/admin/mechanics
Get all mechanics.

**Authentication:** Required (Admin role)

**Query Parameters:**
- `verificationStatus` (optional): Filter by status
- `isOnline` (optional): Filter by online status
- `limit` (optional): Limit results (default: 100)

### PUT /api/admin/mechanics/:mechanicId/verify
Approve or reject mechanic verification.

**Authentication:** Required (Admin role)

**Body:**
```json
{
  "action": "approve" // or "reject"
}
```

**For rejection:**
```json
{
  "action": "reject",
  "reason": "Documents are unclear"
}
```

### GET /api/admin/requests
Get all requests.

**Authentication:** Required (Admin role)

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Limit results (default: 100)

### PUT /api/admin/requests/:requestId/assign
Manually assign a mechanic to a request.

**Authentication:** Required (Admin role)

**Body:**
```json
{
  "mechanicId": "mechanic-id"
}
```

### GET /api/admin/users
Get all users.

**Authentication:** Required (Admin role)

**Query Parameters:**
- `limit` (optional): Limit results (default: 100)

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Development Mode

When `MONGODB_URI` is not set, the API runs in in-memory mock mode. This is useful for development but should not be used in production.

---

## Notes

1. All timestamps are in ISO 8601 format (UTC)
2. Location coordinates use decimal degrees (WGS84)
3. Distance calculations use the Haversine formula
4. The API automatically assigns the nearest mechanic when a request is created
5. Mechanic verification status must be "approved" to receive requests
6. Only online mechanics are considered for auto-assignment

