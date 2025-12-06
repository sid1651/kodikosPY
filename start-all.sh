#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Kodikos Project${NC}"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Check if Docker images exist
if ! docker images | grep -q "kodikos-python"; then
    echo -e "${YELLOW}📦 Building Python Docker image...${NC}"
    cd code-execution-service/python-runner/python-runner
    docker build -t kodikos-python .
    cd ../../..
    echo -e "${GREEN}✅ Python image built${NC}"
else
    echo -e "${GREEN}✅ Python Docker image exists${NC}"
fi

if ! docker images | grep -q "cpp-runner"; then
    echo -e "${YELLOW}📦 Building C++ Docker image...${NC}"
    cd code-execution-service/cpp-runner/cpp-runner
    docker build -t cpp-runner .
    cd ../../..
    echo -e "${GREEN}✅ C++ image built${NC}"
else
    echo -e "${GREEN}✅ C++ Docker image exists${NC}"
fi

echo ""
echo -e "${GREEN}🎯 Starting all services...${NC}"
echo ""

# Start Execution Service
echo -e "${YELLOW}1️⃣ Starting Execution Service (Port 5001)...${NC}"
cd code-execution-service
npm start &
EXECUTION_PID=$!
cd ..

sleep 3

# Start Backend Service
echo -e "${YELLOW}2️⃣ Starting Backend Service (Port 5000)...${NC}"
cd Server
npm start &
BACKEND_PID=$!
cd ..

sleep 3

# Start Frontend
echo -e "${YELLOW}3️⃣ Starting Frontend (Port 3000)...${NC}"
cd reactproject1
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo -e "${GREEN}Services running:${NC}"
echo "  - Execution Service: http://localhost:5001"
echo "  - Backend Service: http://localhost:5000"
echo "  - Frontend: http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for interrupt
trap "echo ''; echo -e '${YELLOW}Stopping all services...${NC}'; kill $EXECUTION_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait

