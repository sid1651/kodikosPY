#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Kodikos Development Environment${NC}"
echo ""

# Check if Docker is running (optional - services will start anyway)
if docker ps > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is running${NC}"
else
    echo -e "${YELLOW}⚠️  Docker is not running${NC}"
    echo -e "${YELLOW}   Services will start, but code execution will fail until Docker is started${NC}"
fi

echo ""
echo -e "${BLUE}Starting services...${NC}"
echo ""

# Start Execution Service (Port 5001)
echo -e "${BLUE}1️⃣ Execution Service starting on port 5001...${NC}"
cd code-execution-service
npm start > /tmp/exec-service.log 2>&1 &
EXEC_PID=$!
cd ..

sleep 3

# Start Backend Service (Port 5000)
echo -e "${BLUE}2️⃣ Backend Service starting on port 5000...${NC}"
cd Server
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

sleep 3

# Start Frontend (Port 3000)
echo -e "${BLUE}3️⃣ Frontend starting on port 3000...${NC}"
cd reactproject1
npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  - Execution Service: http://localhost:5001"
echo "  - Backend: http://localhost:5000"
echo "  - Frontend: http://localhost:3000"
echo ""
echo -e "${YELLOW}Note:${NC}"
echo "  - Services start without Docker"
echo "  - Execution service will initialize container pools in background"
echo "  - If Docker images don't exist, they will be pulled from Docker Hub"
echo "  - Containers stay warm for faster code execution"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  - Execution Service: tail -f /tmp/exec-service.log"
echo "  - Backend: tail -f /tmp/backend.log"
echo "  - Frontend: tail -f /tmp/frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait and cleanup on exit
trap "echo ''; echo -e '${YELLOW}Stopping services...${NC}'; kill $EXEC_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait

