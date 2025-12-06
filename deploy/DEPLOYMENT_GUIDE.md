# Azure VM Deployment Guide

This guide walks you through deploying the Kodikos services to Azure VMs.

## Architecture

- **Backend VM**: Runs the main backend service (port 5002)
- **Execution Service VM**: Runs the code execution service (port 5001)
- **Frontend**: Can be deployed separately (Vercel, Netlify, or another VM)

## Prerequisites

1. Two Azure VMs (Ubuntu 20.04 or 22.04 recommended)
2. SSH access to both VMs
3. Static IP addresses for both VMs (or note down the dynamic IPs)
4. MongoDB instance (local or MongoDB Atlas)
5. Google OAuth credentials (for authentication)

## Step-by-Step Deployment

### Step 1: Prepare Both VMs

On **both VMs**, run the setup script:

```bash
# Upload the setup script to the VM
scp deploy/azure-vm-setup.sh user@vm-ip:/home/user/

# SSH into the VM
ssh user@vm-ip

# Make executable and run
chmod +x azure-vm-setup.sh
./azure-vm-setup.sh
```

**Important**: After the script completes, logout and login again (or run `newgrp docker`) to use Docker without sudo.

### Step 2: Get VM IP Addresses

Note down the IP addresses of both VMs:

```bash
# On each VM, get the IP address
hostname -I
```

- **Backend VM IP**: `X.X.X.X`
- **Execution Service VM IP**: `Y.Y.Y.Y`

### Step 3: Deploy Code Execution Service

On the **Execution Service VM**:

```bash
# Upload deployment script and code
scp -r deploy/deploy-execution-service.sh code-execution-service user@execution-vm-ip:/home/user/

# SSH into the VM
ssh user@execution-vm-ip

# Set backend IP (replace with your backend VM IP)
export BACKEND_IP=X.X.X.X
export BACKEND_PORT=5002

# Make executable and run
chmod +x deploy-execution-service.sh
./deploy-execution-service.sh
```

**Note**: The script will:
- Copy code to `/opt/kodikos/code-execution-service`
- Install dependencies
- Create production `.env` file
- Pull Docker images from Docker Hub
- Configure firewall
- Start service with PM2

### Step 4: Deploy Backend Service

On the **Backend VM**:

```bash
# Upload deployment script and code
scp -r deploy/deploy-backend.sh Server user@backend-vm-ip:/home/user/

# SSH into the VM
ssh user@backend-vm-ip

# Set execution service IP (replace with your execution service VM IP)
export EXECUTION_SERVICE_IP=Y.Y.Y.Y
export EXECUTION_SERVICE_PORT=5001

# Make executable and run
chmod +x deploy-backend.sh
./deploy-backend.sh
```

**Note**: The script will:
- Copy code to `/opt/kodikos/backend`
- Install dependencies
- Create production `.env` file
- Configure firewall
- Start service with PM2

### Step 5: Configure Environment Variables

#### Execution Service VM

Edit `/opt/kodikos/code-execution-service/.env`:

```bash
sudo nano /opt/kodikos/code-execution-service/.env
```

**Important settings to update**:
- `EXECUTION_SERVICE_API_KEY`: Change to a strong random secret
- `CORS_ORIGINS`: Add your frontend URL and backend URL
- `PYTHON_POOL_SIZE` and `CPP_POOL_SIZE`: Adjust based on your needs

After editing, restart the service:
```bash
pm2 restart code-execution-service
```

#### Backend VM

Edit `/opt/kodikos/backend/.env`:

```bash
sudo nano /opt/kodikos/backend/.env
```

**Important settings to update**:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Change to a strong random secret
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Your Google OAuth credentials
- `EXECUTION_SERVICE_API_KEY`: Must match the execution service API key
- `CORS_ORIGIN`: Your frontend URL

After editing, restart the service:
```bash
pm2 restart kodikos-backend
```

### Step 6: Configure Azure Network Security Groups

In Azure Portal, configure Network Security Groups to allow:

**Backend VM**:
- Port 22 (SSH)
- Port 5002 (Backend API)
- Port 80/443 (if using HTTP/HTTPS)

**Execution Service VM**:
- Port 22 (SSH)
- Port 5001 (Execution Service API)
- **Important**: Only allow port 5001 from Backend VM IP (for security)

### Step 7: Verify Deployment

#### Test Execution Service

```bash
# From backend VM or your local machine
curl http://Y.Y.Y.Y:5001/health
# Should return: {"status":"ok","service":"code-execution-service"}

curl http://Y.Y.Y.Y:5001/stats
# Should return pool statistics
```

#### Test Backend Service

```bash
# From your local machine
curl http://X.X.X.X:5002/api/health
# Should return backend status
```

#### Test Code Execution

```bash
# Test C++ execution (from backend VM)
curl -X POST http://Y.Y.Y.Y:5001/execute/cpp \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{"code":"#include <iostream>\nint main(){std::cout<<\"Hello\"<<std::endl;return 0;}"}'
```

## Service Management

### PM2 Commands

Both services run under PM2. Useful commands:

```bash
# Check status
pm2 status

# View logs
pm2 logs code-execution-service  # Execution service
pm2 logs kodikos-backend         # Backend service

# Restart service
pm2 restart code-execution-service
pm2 restart kodikos-backend

# Stop service
pm2 stop code-execution-service
pm2 stop kodikos-backend

# View detailed info
pm2 info code-execution-service
pm2 info kodikos-backend
```

### Logs Location

- Execution Service: `/var/log/kodikos/exec-service-*.log`
- Backend Service: `/var/log/kodikos/backend-*.log`

View logs:
```bash
tail -f /var/log/kodikos/exec-service-out.log
tail -f /var/log/kodikos/backend-out.log
```

## Security Considerations

1. **API Keys**: Use strong, random secrets for `EXECUTION_SERVICE_API_KEY` and `JWT_SECRET`
2. **CORS**: Restrict CORS origins to only your frontend domain
3. **Firewall**: Only open necessary ports
4. **Execution Service**: Restrict port 5001 to only backend VM IP
5. **SSH**: Use key-based authentication, disable password auth
6. **Updates**: Keep system and dependencies updated

## Troubleshooting

### Service Not Starting

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs code-execution-service --lines 50
pm2 logs kodikos-backend --lines 50

# Check if port is in use
sudo lsof -i :5001  # Execution service
sudo lsof -i :5002  # Backend
```

### Docker Issues

```bash
# Check Docker status
sudo systemctl status docker

# Check if images are pulled
docker images | grep sidhu1651

# Test Docker
docker ps
```

### Connection Issues

```bash
# Test connectivity between VMs
# From backend VM:
curl http://Y.Y.Y.Y:5001/health

# From execution service VM:
curl http://X.X.X.X:5002/api/health

# Check firewall
sudo ufw status
```

### Container Pool Issues

```bash
# Check pool stats
curl http://Y.Y.Y.Y:5001/stats

# Check Docker containers
docker ps -a | grep sidhu1651
```

## Updating Services

### Update Code Execution Service

```bash
# SSH into execution service VM
ssh user@execution-vm-ip

# Stop service
pm2 stop code-execution-service

# Update code
cd /opt/kodikos/code-execution-service
git pull  # or copy new files

# Install new dependencies
npm install --production

# Restart service
pm2 restart code-execution-service
```

### Update Backend Service

```bash
# SSH into backend VM
ssh user@backend-vm-ip

# Stop service
pm2 stop kodikos-backend

# Update code
cd /opt/kodikos/backend
git pull  # or copy new files

# Install new dependencies
npm install --production

# Restart service
pm2 restart kodikos-backend
```

## Monitoring

### Health Checks

Set up monitoring to check:
- `http://Y.Y.Y.Y:5001/health` - Execution service health
- `http://X.X.X.X:5002/api/health` - Backend health
- `http://Y.Y.Y.Y:5001/stats` - Container pool statistics

### Resource Monitoring

```bash
# Check system resources
htop

# Check disk space
df -h

# Check memory
free -h

# Check PM2 process info
pm2 monit
```

## Backup and Recovery

### Backup Configuration

```bash
# Backup environment files
sudo cp /opt/kodikos/code-execution-service/.env /opt/kodikos/code-execution-service/.env.backup
sudo cp /opt/kodikos/backend/.env /opt/kodikos/backend/.env.backup
```

### Restore from Backup

```bash
# Restore environment files
sudo cp /opt/kodikos/code-execution-service/.env.backup /opt/kodikos/code-execution-service/.env
sudo cp /opt/kodikos/backend/.env.backup /opt/kodikos/backend/.env

# Restart services
pm2 restart code-execution-service
pm2 restart kodikos-backend
```

## Next Steps

1. Set up SSL/TLS certificates (Let's Encrypt)
2. Configure domain names
3. Set up monitoring and alerting
4. Configure automated backups
5. Set up CI/CD pipeline for deployments

## Support

For issues or questions:
- Check logs: `pm2 logs <service-name>`
- Check health endpoints
- Verify network connectivity
- Review firewall rules

