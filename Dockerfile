# Use Node.js LTS version (18.x) as base image
FROM node:18-alpine

# Set working directory to backend
WORKDIR /app/backend

# Copy package files first (for better Docker layer caching)
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the backend code
COPY backend/ ./

# Expose port (Railway will set PORT environment variable)
EXPOSE 5000

# Start the server
CMD ["npm", "start"]

