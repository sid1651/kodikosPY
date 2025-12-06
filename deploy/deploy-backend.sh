#!/bin/bash

# Deployment Script for Backend Service
# Run this on the Azure VM designated for backend

set -e

echo "🚀 Deploying Backend Service to Azure VM"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SERVICE_DIR="/opt/kodikos/backend"
SERVICE_PORT=5002
EXECUTION_SERVICE_IP="${EXECUTION_SERVICE_IP:-}"  # Set this environment variable
EXECUTION_SERVICE_PORT="${EXECUTION_SERVICE_PORT:-5001}"

# Check if EXECUTION_SERVICE_IP is set
if [ -z "$EXECUTION_SERVICE_IP" ]; then
    echo -e "${RED}❌ ERROR: EXECUTION_SERVICE_IP environment variable not set${NC}"
    echo -e "${YELLOW}Set it with: export EXECUTION_SERVICE_IP=<execution-service-vm-ip-address>${NC}"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Service Directory: $SERVICE_DIR"
echo "  Service Port: $SERVICE_PORT"
echo "  Execution Service IP: $EXECUTION_SERVICE_IP"
echo "  Execution Service Port: $EXECUTION_SERVICE_PORT"
echo ""

# Step 1: Create service directory
echo -e "${BLUE}Step 1: Creating service directory...${NC}"
sudo mkdir -p $SERVICE_DIR
sudo chown $USER:$USER $SERVICE_DIR

# Step 2: Copy code
echo -e "${BLUE}Step 2: Copying code...${NC}"
if [ -d "Server" ]; then
    echo "Copying from local Server directory..."
    cp -r Server/* $SERVICE_DIR/
else
    echo -e "${YELLOW}⚠️  Local Server directory not found.${NC}"
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
PORT=$SERVICE_PORT
NODE_ENV=production

# MongoDB Connection (update with your MongoDB connection string)
MONGODB_URI=mongodb://localhost:27017/kodikos
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kodikos

# JWT Secret (IMPORTANT: Change this to a strong random secret!)
JWT_SECRET=your-jwt-secret-key-change-in-production

# Google OAuth (update with your credentials)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Code Execution Service Configuration
EXECUTION_SERVICE_URL=http://${EXECUTION_SERVICE_IP}:${EXECUTION_SERVICE_PORT}
EXECUTION_SERVICE_API_KEY=exec-service-secret-key-change-in-production

# CORS Configuration (update with your frontend URL)
CORS_ORIGIN=https://your-frontend-domain.com
# For development, you can use:
# CORS_ORIGIN=*
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Step 5: Configure firewall
echo -e "${BLUE}Step 5: Configuring firewall...${NC}"
sudo ufw allow $SERVICE_PORT/tcp
echo -e "${GREEN}✅ Firewall rule added for port $SERVICE_PORT${NC}"

# Step 6: Create PM2 ecosystem file
echo -e "${BLUE}Step 6: Creating PM2 configuration...${NC}"
cat > $SERVICE_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'kodikos-backend',
    script: './server.js',
    cwd: '$SERVICE_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $SERVICE_PORT
    },
    error_file: '/var/log/kodikos/backend-error.log',
    out_file: '/var/log/kodikos/backend-out.log',
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

# Step 7: Start service with PM2
echo -e "${BLUE}Step 7: Starting service with PM2...${NC}"
cd $SERVICE_DIR
pm2 delete kodikos-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Step 8: Setup PM2 startup script
echo -e "${BLUE}Step 8: Setting up PM2 startup script...${NC}"
pm2 startup | grep -v PM2 | sudo bash || true

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Backend Service Deployed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Service Information:${NC}"
echo "  URL: http://$(hostname -I | awk '{print $1}'):$SERVICE_PORT"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  pm2 status                  # Check service status"
echo "  pm2 logs kodikos-backend    # View logs"
echo "  pm2 restart kodikos-backend # Restart service"
echo "  pm2 stop kodikos-backend    # Stop service"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  1. Update MongoDB connection string in .env"
echo "  2. Update JWT_SECRET with a strong random secret"
echo "  3. Update Google OAuth credentials in .env"
echo "  4. Update CORS_ORIGIN with your frontend URL"
echo "  5. Ensure execution service API key matches in both services"
echo "  6. Verify connection to execution service: curl http://${EXECUTION_SERVICE_IP}:${EXECUTION_SERVICE_PORT}/health"
echo ""

