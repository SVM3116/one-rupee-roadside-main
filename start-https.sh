#!/bin/bash

echo "========================================"
echo "  ONE RUPEE RAPIDFIX - HTTPS Server"
echo "========================================"
echo ""

# Check if certificate exists
if [ ! -f "certs/localhost.key" ] || [ ! -f "certs/localhost.crt" ]; then
    echo "ERROR: HTTPS certificate not found!"
    echo ""
    echo "Please run: ./generate-cert.sh"
    echo ""
    exit 1
fi

# Get IP Address
IP=$(hostname -I | awk '{print $1}')

echo "HTTPS Certificate: Found"
echo ""
echo "Your IP Address: $IP"
echo ""
echo "Frontend will be available at:"
echo "  https://localhost:8080"
echo "  https://$IP:8080"
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

# Start Frontend (HTTPS)
echo "[2/2] Starting Frontend Server (HTTPS)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  Servers are running!"
echo "  Press Ctrl+C to stop"
echo "========================================"
echo ""
echo "IMPORTANT: First time access will show security warning."
echo "Click 'Advanced' then 'Proceed to localhost'"
echo ""

# Cleanup on exit
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait

