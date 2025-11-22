#!/bin/bash

echo "========================================"
echo "  ONE RUPEE RAPIDFIX - Network Hosting"
echo "========================================"
echo ""

# Get IP Address
IP=$(hostname -I | awk '{print $1}')

echo "Your IP Address: $IP"
echo ""
echo "Frontend will be available at:"
echo "  http://localhost:8080"
echo "  http://$IP:8080"
echo ""
echo "Backend will be available at:"
echo "  http://localhost:5000"
echo "  http://$IP:5000"
echo ""
echo "========================================"
echo "Starting servers..."
echo "========================================"
echo ""

# Start Backend
echo "[1/2] Starting Backend Server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo "[2/2] Starting Frontend Server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  Servers are running!"
echo "  Press Ctrl+C to stop"
echo "========================================"
echo ""

# Cleanup on exit
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait

