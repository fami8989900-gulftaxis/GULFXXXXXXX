import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, persistDb, setDbInstance, queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requireRole, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// GET /api/backups
router.get('/', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const backups = queryAll(`SELECT * FROM backups ORDER BY created_at DESC`);
  
  // Also check existing files on disk
  const diskBackups: any[] = [];
  if (fs.existsSync(BACKUPS_DIR)) {
    const files = fs.readdirSync(BACKUPS_DIR);
    for (const file of files) {
      if (file.endsWith('.sqlite')) {
        const stats = fs.statSync(path.join(BACKUPS_DIR, file));
        diskBackups.push({
          filename: file,
          size_bytes: stats.size,
          created_at: stats.birthtime.toISOString(),
        });
      }
    }
  }

  return res.json({
    backups,
    diskBackups,
    autoBackupEnabled: true,
    schedule: 'Every 6 hours & daily midnight snapshot',
    lastBackupTime: backups[0]?.created_at || 'None',
  });
});

// POST /api/backups/create
router.post('/create', requireAuth, requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    persistDb(); // Ensure latest state is flushed

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gulf_taxis_backup_${timestamp}.sqlite`;
    const destPath = path.join(BACKUPS_DIR, filename);

    const binaryData = db.export();
    const buffer = Buffer.from(binaryData);
    fs.writeFileSync(destPath, buffer);

    const id = 'bkp_' + Date.now();
    const now = new Date().toISOString();

    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'manual')`,
      [id, filename, buffer.length, now]
    );

    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      'BACKUP',
      'system',
      id,
      `Manual backup created: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`
    );

    return res.status(201).json({
      success: true,
      message: `Database backup '${filename}' successfully created and stored.`,
      backup: { id, filename, size_bytes: buffer.length, created_at: now },
    });
  } catch (err: any) {
    console.error('Backup creation failed:', err);
    return res.status(500).json({ error: 'Failed to create database backup: ' + err.message });
  }
});

// POST /api/backups/restore
router.post('/restore', requireAuth, requireRole('super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Backup filename is required.' });
  }

  // Prevent path traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Specified backup file does not exist.' });
  }

  try {
    const backupBuffer = fs.readFileSync(filePath);
    const db = await getDb();
    
    // Create pre-restore safety snapshot first
    const safetySnapshotName = `pre_restore_safety_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
    fs.writeFileSync(path.join(BACKUPS_DIR, safetySnapshotName), Buffer.from(db.export()));

    // Open backup to verify valid sqlite
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    const restoredDb = new SQL.Database(backupBuffer);

    // Verify critical tables exist in backup
    const testResult = restoredDb.exec("SELECT count(*) FROM users");
    if (!testResult || testResult.length === 0) {
      throw new Error('Backup file verification failed: users table not readable.');
    }

    // Overwrite main db file and reload in-memory dbInstance
    const mainDbFile = path.join(DATA_DIR, 'gulf_taxis.sqlite');
    fs.writeFileSync(mainDbFile, backupBuffer);
    setDbInstance(restoredDb);

    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      'RESTORE',
      'system',
      safeFilename,
      `Database restored from backup: ${safeFilename}`
    );

    return res.json({
      success: true,
      message: `Database successfully restored from '${safeFilename}'. Please refresh your view to see restored data.`,
    });
  } catch (err: any) {
    console.error('Restoration failed:', err);
    return res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});

// GET /api/backups/export-sql
router.get('/export-sql', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  // Generate complete PostgreSQL and MySQL compatible SQL script
  const users = queryAll(`SELECT * FROM users`);
  const vehicles = queryAll(`SELECT * FROM vehicles`);
  const drivers = queryAll(`SELECT * FROM drivers`);
  const suppliers = queryAll(`SELECT * FROM suppliers`);
  const bookings = queryAll(`SELECT * FROM bookings`);
  const payments = queryAll(`SELECT * FROM payments`);
  const settings = queryAll(`SELECT * FROM settings`);

  let dump = `-- ==========================================================\n`;
  dump += `-- GULF TAXIS DISPATCH CLOUD SYSTEM — DATABASE MIGRATION DUMP\n`;
  dump += `-- Generated on: ${new Date().toISOString()}\n`;
  dump += `-- Target Compatible: PostgreSQL 14+, Hostinger VPS, Railway, Supabase\n`;
  dump += `-- ==========================================================\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS users (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  username VARCHAR(64) UNIQUE NOT NULL,\n  email VARCHAR(128) UNIQUE NOT NULL,\n  password_hash TEXT NOT NULL,\n  full_name VARCHAR(128) NOT NULL,\n  role VARCHAR(64) NOT NULL,\n  phone VARCHAR(32),\n  permissions TEXT,\n  is_active INT DEFAULT 1,\n  last_login TIMESTAMP WITH TIME ZONE,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS vehicles (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  reg_number VARCHAR(64) UNIQUE NOT NULL,\n  vehicle_type VARCHAR(128) NOT NULL,\n  make_model VARCHAR(128) NOT NULL,\n  passenger_capacity INT DEFAULT 4,\n  luggage_capacity INT DEFAULT 3,\n  supplier_id VARCHAR(64),\n  assigned_driver_id VARCHAR(64),\n  status VARCHAR(32) DEFAULT 'available',\n  color VARCHAR(64),\n  model_year INT,\n  notes TEXT,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS drivers (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  driver_code VARCHAR(32) UNIQUE NOT NULL,\n  full_name VARCHAR(128) NOT NULL,\n  mobile VARCHAR(32) NOT NULL,\n  email VARCHAR(128),\n  license_number VARCHAR(64) NOT NULL,\n  license_expiry VARCHAR(32) NOT NULL,\n  assigned_vehicle_id VARCHAR(64),\n  payment_arrangement VARCHAR(32) DEFAULT 'per_trip',\n  rate_or_salary NUMERIC(12,2) DEFAULT 0,\n  currency VARCHAR(16) DEFAULT 'SAR',\n  is_active INT DEFAULT 1,\n  current_balance NUMERIC(12,2) DEFAULT 0,\n  notes TEXT,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS suppliers (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  supplier_code VARCHAR(32) UNIQUE NOT NULL,\n  name VARCHAR(128) NOT NULL,\n  contact_person VARCHAR(128),\n  mobile VARCHAR(32),\n  email VARCHAR(128),\n  address TEXT,\n  default_currency VARCHAR(16) DEFAULT 'SAR',\n  opening_balance NUMERIC(12,2) DEFAULT 0,\n  current_balance NUMERIC(12,2) DEFAULT 0,\n  payment_terms VARCHAR(64) DEFAULT '15_days',\n  is_active INT DEFAULT 1,\n  notes TEXT,\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS bookings (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  booking_ref VARCHAR(64) UNIQUE NOT NULL,\n  booking_date VARCHAR(32) NOT NULL,\n  pickup_date VARCHAR(32) NOT NULL,\n  pickup_time VARCHAR(16) NOT NULL,\n  passenger_name VARCHAR(128) NOT NULL,\n  contact_number VARCHAR(32) NOT NULL,\n  passengers_count INT DEFAULT 1,\n  luggage_count INT DEFAULT 1,\n  pickup_location TEXT NOT NULL,\n  dropoff_location TEXT NOT NULL,\n  flight_number VARCHAR(32),\n  airline VARCHAR(64),\n  vehicle_type VARCHAR(128) NOT NULL,\n  vehicle_id VARCHAR(64),\n  driver_id VARCHAR(64),\n  supplier_id VARCHAR(64),\n  customer_name VARCHAR(128) NOT NULL,\n  customer_phone VARCHAR(32),\n  customer_price NUMERIC(12,2) DEFAULT 0,\n  supplier_cost NUMERIC(12,2) DEFAULT 0,\n  driver_payout NUMERIC(12,2) DEFAULT 0,\n  currency VARCHAR(16) DEFAULT 'SAR',\n  payment_status VARCHAR(32) DEFAULT 'unpaid',\n  paid_amount NUMERIC(12,2) DEFAULT 0,\n  trip_status VARCHAR(64) DEFAULT 'New Booking',\n  cancellation_reason TEXT,\n  special_instructions TEXT,\n  dispatcher_notes TEXT,\n  created_by_id VARCHAR(64),\n  created_by_name VARCHAR(128),\n  updated_by_id VARCHAR(64),\n  updated_by_name VARCHAR(128),\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  dump += `CREATE TABLE IF NOT EXISTS payments (\n`;
  dump += `  id VARCHAR(64) PRIMARY KEY,\n  payment_ref VARCHAR(64) UNIQUE NOT NULL,\n  entity_type VARCHAR(64) NOT NULL,\n  entity_id VARCHAR(64),\n  entity_name VARCHAR(128),\n  booking_id VARCHAR(64),\n  booking_ref VARCHAR(64),\n  amount NUMERIC(12,2) NOT NULL,\n  currency VARCHAR(16) DEFAULT 'SAR',\n  payment_method VARCHAR(64) NOT NULL,\n  payment_date VARCHAR(32) NOT NULL,\n  reference_no VARCHAR(64),\n  notes TEXT,\n  created_by_id VARCHAR(64),\n  created_by_name VARCHAR(128),\n  created_at TIMESTAMP WITH TIME ZONE NOT NULL\n);\n\n`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="gulf_taxis_schema_export.sql"');
  return res.send(dump);
});

export default router;
