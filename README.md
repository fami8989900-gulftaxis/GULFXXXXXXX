# 🚖 GULF TAXIS DISPATCH CLOUD — PRODUCTION SYSTEM MANUAL

**Gulf Taxis Dispatch Cloud System** is an enterprise-grade web application for chauffeur services, airport transfers, VIP transport bookings, dispatch fleet control, supplier account reconciliation, and executive financial reporting.

---

## 📑 Table of Contents

1. [System Architecture](#-system-architecture)
2. [Prerequisites](#-prerequisites)
3. [Quick Start (Local or Development)](#-quick-start)
4. [Production Deployment on Linux VPS (Hostinger, Ubuntu, Debian, DigitalOcean)](#-production-deployment-on-linux-vps)
5. [Docker Deployment](#-docker-deployment)
6. [Cloud Hosting (Railway / Render / Cloud Run)](#-cloud-hosting)
7. [Default User Credentials & Roles](#-default-user-credentials--roles)
8. [Database Engine & Migration Scripts](#-database-engine--migration-scripts)
9. [Automated Backup & Disaster Recovery](#-automated-backup--disaster-recovery)
10. [Troubleshooting & Support](#-troubleshooting)

---

## 🏗️ System Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend API**: Node.js + Express
- **Database Engine**: Relational SQLite (`data/gulf_taxis.sqlite`) with automatic filesystem persistence and PostgreSQL-compatible DDL export (`database_schema.sql`)
- **Process Management**: TSX runtime, compatible with PM2 (`ecosystem.config.cjs`)
- **Security & RBAC**: Password hashing via Bcrypt, signed JWT sessions with HTTP-only cookies, and role-based route guards
- **Reporting & Exports**: Client and server-side PDF voucher generation (`jspdf`, `jspdf-autotable`), XLSX spreadsheets (`xlsx`), and CSV

---

## 📋 Prerequisites

- **Node.js**: v20.x LTS or v22.x LTS
- **npm**: v9.x or v10.x
- **OS**: Linux (Ubuntu 20.04/22.04/24.04, Debian 11/12), macOS, or Windows 10/11
- **Memory**: Minimum 512 MB RAM (1 GB recommended)
- **Disk**: 500 MB free disk space

---

## ⚡ Quick Start

Extract the ZIP package and run the following in your terminal:

```bash
# 1. Enter the project directory
cd Gulf_Taxis_Dispatch_Cloud_Complete

# 2. Copy the environment configuration template
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Start the full-stack development server
npm run dev
```

Open your browser at: **`http://localhost:3000`**

---

## 🌐 Production Deployment on Linux VPS

Recommended for Hostinger VPS, DigitalOcean Droplets, Linode, AWS EC2, or any Ubuntu/Debian server.

### Step 1: Connect via SSH & Install Dependencies

```bash
ssh root@YOUR_SERVER_IP

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS, Nginx, and build essentials
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# Install PM2 process manager globally
sudo npm install -g pm2
```

### Step 2: Upload or Extract the Codebase

```bash
# Create application directory
sudo mkdir -p /var/www/gulf-taxis
cd /var/www/gulf-taxis

# Unzip the package into this directory
# (e.g., unzip /path/to/Gulf_Taxis_Dispatch_Cloud_Complete.zip -d .)
```

### Step 3: Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Ensure the `.env` file contains:
```env
PORT=3000
NODE_ENV=production
APP_URL=https://dispatch.yourdomain.com
JWT_SECRET=your_super_strong_random_secret_at_least_32_characters
TZ=Asia/Riyadh
```

### Step 4: Install Dependencies & Build Frontend

```bash
npm install
npm run build
```

### Step 5: Start with PM2 Process Manager

```bash
# Start application using PM2 ecosystem file
pm2 start ecosystem.config.cjs

# Save PM2 process list so it automatically restarts on server reboot
pm2 save
pm2 startup
```

### Step 6: Configure Nginx as Reverse Proxy with SSL

Create a new Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/gulf-taxis
```

Paste the following configuration:
```nginx
server {
    server_name dispatch.yourdomain.com;

    client_max_body_size 25M;

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

Enable the site and obtain a free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/gulf-taxis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue free Let's Encrypt SSL certificate
sudo certbot --nginx -d dispatch.yourdomain.com
```

---

## 🐳 Docker Deployment

The package includes a production-ready `Dockerfile` and `docker-compose.yml`.

```bash
# 1. Build and start the container
docker compose up -d --build

# 2. View logs
docker compose logs -f

# 3. Stop containers
docker compose down
```

The database file `data/gulf_taxis.sqlite` and backup directory are stored on a persistent Docker volume.

---

## ☁️ Cloud Hosting (Railway / Render / Cloud Run)

1. Connect your Git repository or upload the package to GitHub/GitLab.
2. Configure **Environment Variables**:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `JWT_SECRET=your_random_secret`
3. Configure build & start commands:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Attach a **Persistent Disk** mounted at `/var/www/data` or `./data` so your database is preserved across container redeployments.

---

## 🔐 Default User Credentials & Roles

The system comes pre-seeded with authorized accounts for every operational department.

| Role | Username | Initial Password | Permissions |
|---|---|---|---|
| **👑 Super Administrator** | `superadmin` | `Admin@123` | Full access across all modules, settings, users, and backups |
| **🛡️ Administrator** | `admin` | `Admin@123` | User management, operations, and dispatch oversight |
| **🚘 Dispatcher** | `dispatcher` | `Dispatch@123` | Dispatch control centre, driver assignment, vehicle tracking |
| **📅 Booking Agent** | `bookingagent` | `Agent@123` | Booking creation, passenger details, voucher generation |
| **💳 Finance Executive** | `finance` | `Finance@123` | Payments, supplier invoices, driver payouts, ledger balance |
| **👁️ Report Viewer** | `reportviewer` | `Viewer@123` | Read-only view for all 15 analytical and operational reports |

> **Security Notice:** Log in as `superadmin` and navigate to **Settings > User Accounts** or **Profile > Change Password** to set unique passwords immediately upon deployment.

---

## 🗄️ Database Engine & Migration Scripts

The database engine is self-contained and requires no separate PostgreSQL or MySQL server installation to start:
- Stored on disk at `data/gulf_taxis.sqlite`.
- Includes automated schemas for `users`, `drivers`, `vehicles`, `suppliers`, `bookings`, `payments`, `trip_status_logs`, `audit_logs`, `settings`, and `backups`.
- For organizations migrating to an external PostgreSQL instance (e.g. Supabase, Neon, or Hostinger Cloud SQL), run `database_schema.sql` on your target PostgreSQL database.

---

## 💾 Automated Backup & Disaster Recovery

- **Automated Backups:** Run automatically every 6 hours in the background and save timestamped snapshots to `data/backups/`.
- **Manual Backups:** Can be triggered anytime via **Settings > System Backup & Disaster Recovery > Create Backup Now**.
- **Restoration:** Select any snapshot in the backup table and click **Restore Snapshot**. A pre-restore safety snapshot is automatically created before any restoration proceeds.
- **In-Memory Hot Reload:** The database engine instantly reloads the restored database without dropping web server sessions.

---

## 🧪 Running Automated Tests

Run the comprehensive 43-point test suite:

```bash
npm test
```

This verifies:
- Bcrypt password authentication and JWT signing
- Multi-user RBAC role restrictions
- Two-way driver and vehicle assignment synchronization
- Booking creation and 2-minute duplicate prevention
- Revenue, cost of sales, and gross profit formulas
- All 15 operational and financial reports
- SQLite export stream and memory hot reload

---

## 📞 Support & Maintenance

For questions or assistance regarding this software package, contact:
- **Email:** dispatch@gulftaxis.com
- **Website:** https://gulftaxis.com
- **Timezone:** Asia/Riyadh (UTC+3)
