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
    timezone: 'Asia/Riyadh',
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

// Vite middleware or static dist
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gulf Taxis Dispatch System] Server listening on http://0.0.0.0:${PORT}`);
});
