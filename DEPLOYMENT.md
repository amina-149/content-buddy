# EXTRACT - YouTube Video Downloader
## Complete Setup & Deployment Guide

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Security Setup](#security-setup)
5. [Deployment](#deployment)
6. [Features](#features)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- yt-dlp installed
- npm or yarn

### 5-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
export JWT_SECRET="your-super-secret-key-here"
export ADMIN_PASSWORD="your-secure-password"
export NODE_ENV="production"

# 3. Start the server
npm start
```

Server runs on `http://localhost:3000`

---

## 📦 Installation

### 1. Install yt-dlp

**macOS:**
```bash
brew install yt-dlp
```

**Ubuntu/Debian:**
```bash
sudo apt install yt-dlp
```

**Windows (Chocolatey):**
```bash
choco install yt-dlp
```

**Using pip (any OS):**
```bash
pip install yt-dlp
```

Verify installation:
```bash
yt-dlp --version
```

### 2. Install Node Dependencies

```bash
npm install
```

This installs:
- **express** - Web framework
- **cors** - Cross-origin support
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **mongo-sanitize** - Input sanitization
- **validator** - Input validation

### 3. Create Directory Structure

```
youtube-downloader/
├── server.js                 # Backend server
├── package.json              # Dependencies
├── public/
│   ├── index.html           # User interface
│   └── admin.html           # Admin dashboard
├── logs/                     # (auto-created)
│   ├── downloads.json
│   ├── stats.json
│   └── errors.json
└── node_modules/
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=your-very-long-random-secret-key-min-32-chars
ADMIN_PASSWORD=your-strong-admin-password

# Optional
LOG_LEVEL=info
DOWNLOAD_TIMEOUT=300000
MAX_PLAYLIST_SIZE=100
```

### Load Environment Variables

```bash
# Linux/macOS
export $(cat .env | grep -v '#' | xargs)

# Windows (PowerShell)
Get-Content .env | ForEach-Object {
  if ($_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$') {
    [Environment]::SetEnvironmentVariable($_.split('=')[0], $_.split('=')[1])
  }
}
```

---

## 🔐 Security Setup

### 1. Generate Strong JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use this in your `.env` as `JWT_SECRET`

### 2. Create Strong Admin Password

Requirements:
- At least 16 characters
- Mix of uppercase, lowercase, numbers, symbols
- Unique and memorable to you only

Example:
```
P@ssw0rd!2024#YTDL$Secure
```

### 3. HTTPS/SSL Certificate

**For production, HTTPS is REQUIRED.**

#### Using Let's Encrypt (Free):

```bash
npm install express-force-https

# In server.js, add:
const forceHttps = require('express-force-https');
app.use(forceHttps);
```

#### Self-signed (Development only):

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365
```

Then in server.js:
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000);
```

### 4. Rate Limiting

Already configured in `server.js`:
- Login attempts: 5 per 15 minutes per IP
- Downloads: 5 per minute per user
- Disable in development mode

Adjust in `server.js`:
```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                      // 5 requests
  message: 'Too many attempts...'
});
```

### 5. Input Validation

All user inputs are:
- ✅ Validated with `validator.js`
- ✅ Sanitized with `mongo-sanitize`
- ✅ Escaped before storage
- ✅ Checked for YouTube URLs

### 6. Password Hashing

Admin passwords are hashed using bcryptjs:
- 10 salt rounds
- Never stored in plain text
- Compared securely

---

## 🌍 Deployment

### Option 1: Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set JWT_SECRET="your-secret"
heroku config:set ADMIN_PASSWORD="your-password"
heroku config:set NODE_ENV="production"

# Add yt-dlp buildpack
heroku buildpacks:add https://github.com/yt-dlp/yt-dlp-heroku-buildpack.git

# Deploy
git push heroku main
```

### Option 2: DigitalOcean / Linode

```bash
# SSH into your server
ssh root@your_server_ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install yt-dlp
sudo apt install yt-dlp

# Clone your repository
git clone your-repo-url
cd youtube-downloader

# Install dependencies
npm install

# Create .env file
nano .env
# Add your configuration

# Install PM2 (process manager)
sudo npm install -g pm2

# Start with PM2
pm2 start server.js --name "ytdownloader"
pm2 startup
pm2 save

# Setup Nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/default

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 3: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install yt-dlp
RUN apk add --no-cache python3 py3-pip
RUN pip install yt-dlp

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t ytdownloader .
docker run -p 3000:3000 \
  -e JWT_SECRET="your-secret" \
  -e ADMIN_PASSWORD="your-password" \
  -e NODE_ENV="production" \
  ytdownloader
```

---

## ✨ Features

### User Features
- ✅ Single video downloads
- ✅ Playlist downloads (up to 100 videos)
- ✅ 6 quality options (4K to MP3)
- ✅ Subtitle download (all available languages)
- ✅ Download history with redownload
- ✅ Real-time progress (speed, ETA, size)
- ✅ User-friendly error messages
- ✅ Responsive design

### Admin Features
- 🔐 Secure password-protected dashboard
- 📊 Real-time statistics
- 📈 Download analytics (by type, quality, user)
- ⚠️ Error tracking and top errors
- 📝 Recent downloads log
- 🖥️ Server health monitoring
- 🔑 JWT token-based authentication
- 📋 Audit logs

---

## 🐛 Troubleshooting

### "yt-dlp command not found"

```bash
# Verify installation
yt-dlp --version

# If not found, install via pip
pip install --upgrade yt-dlp

# Check PATH
which yt-dlp
```

### Downloads failing with "Quality unavailable"

This is intentional! The server automatically falls back to the next best quality.

### Admin login fails

1. Check your password in `.env`
2. Ensure NODE_ENV is set correctly
3. Check server logs for errors

### Rate limiting blocking downloads

Wait 1 minute and try again. Rate limits reset after the window expires.

```
Max: 5 downloads per minute per user
```

### Server won't start on port 3000

```bash
# Port already in use - find what's using it
lsof -i :3000

# Use different port
PORT=3001 npm start

# Or kill the process
kill -9 <PID>
```

### Slow downloads

1. Check your internet speed
2. Select a lower quality
3. Avoid peak hours
4. Check server disk space

```bash
df -h  # Check disk space
```

### SSL/Certificate errors

For production:
1. Use Let's Encrypt (free)
2. Renew every 90 days
3. Check certificate expiry: `openssl x509 -in cert.pem -noout -dates`

---

## 📞 Support & Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Logs Location

Logs are stored in user home directory:
```
~/.ytdownloader/
├── downloads.json  # Download history
├── stats.json      # Statistics
└── errors.json     # Error logs
```

### Monitoring Dashboard

Admin dashboard shows:
- Real-time stats
- Error metrics
- Server health
- User activity

Access: `http://your-domain.com/admin.html`

---

## 🔄 Updating

```bash
# Pull latest changes
git pull

# Update dependencies
npm install

# Restart server
pm2 restart ytdownloader
```

---

## 📝 License

MIT License - Feel free to use and modify

---

## ⚡ Performance Tips

1. **Use a CDN** for static files
2. **Enable caching** in Nginx/Apache
3. **Monitor disk space** - limit old downloads
4. **Use a queue system** for many concurrent downloads
5. **Scale horizontally** with load balancer

---

## 🎯 Next Steps

1. ✅ Configure environment variables
2. ✅ Set strong passwords
3. ✅ Setup HTTPS
4. ✅ Deploy to server
5. ✅ Monitor admin dashboard
6. ✅ Backup logs regularly

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Maintainer**: YTDL Team
