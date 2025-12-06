#!/bin/bash

# Azure VM Setup Script
# This script installs all required dependencies for running the Kodikos services
# Run this on BOTH VMs (backend and code-execution-service)

set -e

echo "🚀 Setting up Azure VM for Kodikos Services"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root (some commands need sudo)
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Some commands may require sudo. You may be prompted for password.${NC}"
fi

echo -e "${BLUE}Step 1: Updating system packages...${NC}"
sudo apt-get update -y
sudo apt-get upgrade -y

echo -e "${BLUE}Step 2: Installing Node.js (v20.x)...${NC}"
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ Node.js installed: ${NODE_VERSION}${NC}"
echo -e "${GREEN}✅ npm installed: ${NPM_VERSION}${NC}"

echo -e "${BLUE}Step 3: Installing Docker...${NC}"
# Install Docker
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify Docker installation
DOCKER_VERSION=$(docker --version)
echo -e "${GREEN}✅ Docker installed: ${DOCKER_VERSION}${NC}"

echo -e "${BLUE}Step 4: Installing Git...${NC}"
sudo apt-get install -y git
GIT_VERSION=$(git --version)
echo -e "${GREEN}✅ Git installed: ${GIT_VERSION}${NC}"

echo -e "${BLUE}Step 5: Installing PM2 (Process Manager)...${NC}"
sudo npm install -g pm2
PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}✅ PM2 installed: v${PM2_VERSION}${NC}"

echo -e "${BLUE}Step 6: Installing additional utilities...${NC}"
sudo apt-get install -y \
    build-essential \
    curl \
    wget \
    vim \
    htop \
    net-tools \
    ufw

echo -e "${BLUE}Step 7: Setting up firewall rules...${NC}"
# Allow SSH (port 22)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if needed)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Note: Service-specific ports will be configured in deployment scripts
echo -e "${YELLOW}⚠️  Firewall configured. Service-specific ports will be opened during deployment.${NC}"

echo -e "${BLUE}Step 8: Creating application directory...${NC}"
sudo mkdir -p /opt/kodikos
sudo chown $USER:$USER /opt/kodikos
echo -e "${GREEN}✅ Application directory created: /opt/kodikos${NC}"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ VM Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "  1. Docker group membership requires logout/login to take effect"
echo "  2. You may need to run: newgrp docker (or logout/login)"
echo "  3. Next steps:"
echo "     - For Backend VM: Run deploy-backend.sh"
echo "     - For Execution Service VM: Run deploy-execution-service.sh"
echo ""
echo -e "${YELLOW}To verify Docker without sudo, logout and login again, then run:${NC}"
echo "  docker ps"
echo ""

