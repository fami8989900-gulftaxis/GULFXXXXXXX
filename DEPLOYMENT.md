# 🌐 Gulf Taxis Dispatch Cloud System — Production Deployment Guide

This document outlines the step-by-step procedures to deploy the **Gulf Taxis Dispatch Cloud System** across multiple hosting environments, including Hostinger VPS / Cloud Hosting, Railway, Docker, and standard Ubuntu/Debian Linux VPS.

---

## 1. Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend API**: Node.js + Express
- **Database Engine**: Persistent Relational SQL (embedded portable zero-dependency SQL engine with automatic filesystem persistence and PostgreSQL schema export)
- **Authentication**: JWT token + HTTP-Only secure cookies + Role-Based Access Control (RBAC)
- **Synchronization**: Multi-device live polling & state broadcast
- **Documents & Reports**: Client & server PDF voucher rendering, XLSX spreadsheet export, CSV

---

## 2. Option A: Deployment on Hostinger VPS or Linux VPS (Recommended)

Hostinger Business Web Hosting provides VPS plans running Ubuntu 22.04 / 24.04 LTS with Node.js and PM2.

### Step 1: Connect to your VPS via SSH
```bash
ssh root@your_server_ip
```

### Step 2: Install Node.js (v20 or v22 LTS) and PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
```

### Step 3: Clone or Upload the Gulf Taxis System
```bash
cd /var/www
git clone <your-private-repo-url> gulf-taxis
cd gulf-taxis
```

### Step 4: Configure Environment Variables
```bash
cp .env.example .env
nano .env
```
Ensure `PORT=3000`, `NODE_ENV=production`, and a strong `JWT_SECRET` are configured.

### Step 5: Install Dependencies and Build
```bash
npm install
npm run build
```

### Step 6: Start with PM2 Process Manager
```bash
pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name "gulf-taxis"
pm2 save
pm2 startup
```

### Step 7: Configure Nginx Reverse Proxy with SSL (Let's Encrypt)
Create `/etc/nginx/sites-available/gulftaxis`:
```nginx
server {
    server_name dispatch.gulftaxis.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable site and generate free SSL certificate:
```bash
ln -s /etc/nginx/sites-available/gulftaxis /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d dispatch.gulftaxis.com
```

---

## 3. Option B: Deployment on Railway

1. Link your GitHub repository in Railway dashboard.
2. Under **Variables**, add:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `JWT_SECRET=<your-secret>`
3. Set the build command to: `npm run build`
4. Set the start command to: `npm start` (or `tsx server.ts`)
5. Attach a Railway persistent volume to `/var/www/data` or `./data` to retain the SQLite file across deployments.

---

## 4. Default Seed Administrator Credentials

Upon first startup, the database is automatically provisioned with the following accounts:

| Role | Username / Email | Default Password |
|---|---|---|
| **Super Administrator** | `superadmin` / `superadmin@gulftaxis.com` | `Admin@123` |
| **Administrator** | `admin` / `admin@gulftaxis.com` | `Admin@123` |
| **Booking Agent** | `agent` / `agent@gulftaxis.com` | `Agent@123` |
| **Dispatcher** | `dispatcher` / `dispatcher@gulftaxis.com` | `Dispatch@123` |
| **Finance Executive** | `finance` / `finance@gulftaxis.com` | `Finance@123` |
| **Report Viewer** | `viewer` / `viewer@gulftaxis.com` | `Viewer@123` |

*Security Warning: Change default passwords immediately upon initial production login in Settings > Users.*

---

## 5. Automated Backups & Disaster Recovery

- Backups are generated automatically every 6 hours and stored in `./data/backups/`.
- Administrators can trigger an on-demand snapshot via the **Settings > Backup & Recovery** interface.
- Complete database rollback can be performed with one click from the administration dashboard.
- To export the database schema and all rows for migration to PostgreSQL, use the **Export SQL** tool in the Backup menu.
