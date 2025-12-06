#!/bin/bash

# Simple script to run all services
# Run each service in a separate terminal or use a process manager

echo "🚀 Starting Kodikos Development Environment"
echo ""
echo "Starting services..."
echo ""

# Start Execution Service (Port 5001)
echo "1️⃣ Execution Service starting on port 5001..."
cd code-execution-service
npm start &
EXEC_PID=$!
cd ..

sleep 2

# Start Backend Service (Port 5000)
echo "2️⃣ Backend Service starting on port 5000..."
cd Server
npm start &
BACKEND_PID=$!
cd ..

sleep 2

# Start Frontend (Port 3000)
echo "3️⃣ Frontend starting on port 3000..."
cd reactproject1
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "Services:"
echo "  - Execution Service: http://localhost:5001"
echo "  - Backend: http://localhost:5000"
echo "  - Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "echo ''; echo 'Stopping services...'; kill $EXEC_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait

