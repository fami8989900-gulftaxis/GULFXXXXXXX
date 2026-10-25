import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb, persistDb, queryOne, runSql } from './server/db.js';
import authRoutes from './server/routes/authRoutes.js';
import bookingRoutes from './server/routes/bookingRoutes.js';
import dispatchRoutes from './server/routes/dispatchRoutes.js';
import driverRoutes from './server/routes/driverRoutes.js';
import vehicleRoutes from './server/routes/vehicleRoutes.js';
import supplierRoutes from './server/routes/supplierRoutes.js';
import financeRoutes from './server/routes/financeRoutes.js';
import reportRoutes from './server/routes/reportRoutes.js';
import backupRoutes from './server/routes/backupRoutes.js';
import userRoutes from './server/routes/userRoutes.js';
import settingsRoutes from './server/routes/settingsRoutes.js';
import syncRoutes from './server/routes/syncRoutes.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize database
await getDb();

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Gulf Taxis Dispatch Cloud System',
    timestamp: new Date().toISOString(),
    database: 'connected',
    timezone: process.env.TZ || 'Asia/Riyadh',
    node_version: process.version,
    environment: process.env.NODE_ENV || 'production',
  });
});

// Direct Download Endpoint for Complete ZIP Package
app.get(['/Gulf_Taxis_Dispatch_Cloud_Complete.zip', '/api/download-package'], (req, res) => {
  const publicZip = path.resolve(process.cwd(), 'public', 'Gulf_Taxis_Dispatch_Cloud_Complete.zip');
  const rootZip = path.resolve(process.cwd(), 'Gulf_Taxis_Dispatch_Cloud_Complete.zip');
  const targetZip = fs.existsSync(publicZip) ? publicZip : rootZip;

  if (fs.existsSync(targetZip)) {
    res.setHeader('Content-Disposition', 'attachment; filename="Gulf_Taxis_Dispatch_Cloud_Complete.zip"');
    res.setHeader('Content-Type', 'application/zip');
    return res.sendFile(targetZip);
  }
  return res.status(404).json({ error: 'Package archive not found. Please contact administrator.' });
});

// Setup automated background backup schedule (runs every 6 hours)
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
async function performAutomatedBackup() {
  try {
    const db = await getDb();
    persistDb();
    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto_backup_${timestamp}.sqlite`;
    const dest = path.join(backupDir, filename);
    const data = Buffer.from(db.export());
    fs.writeFileSync(dest, data);

    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'automated')`,
      ['auto_' + Date.now(), filename, data.length, new Date().toISOString()]
    );
    console.log(`[Gulf Taxis] Automated backup successfully saved: ${filename}`);
  } catch (err) {
    console.error('[Gulf Taxis] Automated backup error:', err);
  }
}
setInterval(performAutomatedBackup, BACKUP_INTERVAL_MS);

// API 404 handler for undefined API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
});

// Vite middleware or static dist
const distPath = path.resolve(process.cwd(), 'dist');
const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
const isProduction = process.env.NODE_ENV === 'production' || hasDist;

if (!isProduction) {
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.warn('[Gulf Taxis] Vite dev middleware not available, falling back to static files.');
    if (hasDist) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }
} else {
  if (hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('*', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Gulf Taxis Dispatch Cloud</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
          <h2>🚖 Gulf Taxis Dispatch Cloud Server Active</h2>
          <p>The backend API and database are online. Frontend assets need to be built.</p>
          <p>Please run <code>npm run build</code> to generate the production frontend.</p>
          <p><a href="/api/health" style="color: #38bdf8;">Check API Health Status</a></p>
        </body>
        </html>
      `);
    });
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gulf Taxis Dispatch System] Server listening on http://0.0.0.0:${PORT}`);
});
