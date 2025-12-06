#!/bin/bash

# Deployment Script for Code Execution Service
# Run this on the Azure VM designated for code execution

set -e

echo "🚀 Deploying Code Execution Service to Azure VM"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SERVICE_DIR="/opt/kodikos/code-execution-service"
SERVICE_PORT=5001
BACKEND_IP="${BACKEND_IP:-}"  # Set this environment variable or edit below
BACKEND_PORT="${BACKEND_PORT:-5002}"

# Check if BACKEND_IP is set
if [ -z "$BACKEND_IP" ]; then
    echo -e "${RED}❌ ERROR: BACKEND_IP environment variable not set${NC}"
    echo -e "${YELLOW}Set it with: export BACKEND_IP=<backend-vm-ip-address>${NC}"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Service Directory: $SERVICE_DIR"
echo "  Service Port: $SERVICE_PORT"
echo "  Backend IP: $BACKEND_IP"
echo "  Backend Port: $BACKEND_PORT"
echo ""

# Step 1: Create service directory
echo -e "${BLUE}Step 1: Creating service directory...${NC}"
sudo mkdir -p $SERVICE_DIR
sudo chown $USER:$USER $SERVICE_DIR

# Step 2: Copy code (assuming code is in current directory or git repo)
echo -e "${BLUE}Step 2: Copying code...${NC}"
if [ -d "code-execution-service" ]; then
    echo "Copying from local code-execution-service directory..."
    cp -r code-execution-service/* $SERVICE_DIR/
else
    echo -e "${YELLOW}⚠️  Local code-execution-service directory not found.${NC}"
    echo -e "${YELLOW}Please ensure code is available or clone from git repository.${NC}"
    exit 1
fi

# Step 3: Install dependencies
echo -e "${BLUE}Step 3: Installing Node.js dependencies...${NC}"
cd $SERVICE_DIR
npm install --production

# Step 4: Create production .env file
echo -e "${BLUE}Step 4: Creating production environment file...${NC}"
cat > $SERVICE_DIR/.env << EOF
# Production Environment Variables
EXECUTION_SERVICE_PORT=$SERVICE_PORT
PYTHON_POOL_SIZE=5
CPP_POOL_SIZE=5

# IMPORTANT: Change this to a strong random secret in production!
EXECUTION_SERVICE_API_KEY=exec-service-secret-key-change-in-production

# Container idle timeout (2 minutes)
CONTAINER_IDLE_TIMEOUT=120000

# Docker Hub images
PYTHON_DOCKER_IMAGE=sidhu1651/kodikos-python
CPP_DOCKER_IMAGE=sidhu1651/cpp-runner

# Backend service URL (for CORS and communication)
BACKEND_URL=http://${BACKEND_IP}:${BACKEND_PORT}

# CORS Configuration (comma-separated list of allowed origins)
# Include your frontend URL and backend URL
CORS_ORIGINS=http://${BACKEND_IP}:${BACKEND_PORT},https://your-frontend-domain.com
# For development, you can use '*' to allow all origins
# CORS_ORIGINS=*
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Step 5: Pull Docker images
echo -e "${BLUE}Step 5: Pulling Docker images from Docker Hub...${NC}"
docker pull sidhu1651/kodikos-python:latest || echo -e "${YELLOW}⚠️  Failed to pull Python image${NC}"
docker pull sidhu1651/cpp-runner:latest || echo -e "${YELLOW}⚠️  Failed to pull C++ image${NC}"

# Step 6: Configure firewall
echo -e "${BLUE}Step 6: Configuring firewall...${NC}"
sudo ufw allow $SERVICE_PORT/tcp
echo -e "${GREEN}✅ Firewall rule added for port $SERVICE_PORT${NC}"

# Step 7: Create PM2 ecosystem file
echo -e "${BLUE}Step 7: Creating PM2 configuration...${NC}"
cat > $SERVICE_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'code-execution-service',
    script: './server.js',
    cwd: '$SERVICE_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $SERVICE_PORT
    },
    error_file: '/var/log/kodikos/exec-service-error.log',
    out_file: '/var/log/kodikos/exec-service-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false
  }]
};
EOF

# Create log directory
sudo mkdir -p /var/log/kodikos
sudo chown $USER:$USER /var/log/kodikos

# Step 8: Start service with PM2
echo -e "${BLUE}Step 8: Starting service with PM2...${NC}"
cd $SERVICE_DIR
pm2 delete code-execution-service 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Step 9: Setup PM2 startup script
echo -e "${BLUE}Step 9: Setting up PM2 startup script...${NC}"
pm2 startup | grep -v PM2 | sudo bash || true

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Code Execution Service Deployed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Service Information:${NC}"
echo "  URL: http://$(hostname -I | awk '{print $1}'):$SERVICE_PORT"
echo "  Health: http://$(hostname -I | awk '{print $1}'):$SERVICE_PORT/health"
echo "  Stats: http://$(hostname -I | awk '{print $1}'):$SERVICE_PORT/stats"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  pm2 status                    # Check service status"
echo "  pm2 logs code-execution-service  # View logs"
echo "  pm2 restart code-execution-service  # Restart service"
echo "  pm2 stop code-execution-service     # Stop service"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  1. Update EXECUTION_SERVICE_API_KEY in .env with a strong secret"
echo "  2. Ensure backend service can reach this VM on port $SERVICE_PORT"
echo "  3. Verify Docker images are pulled: docker images | grep sidhu1651"
echo ""

