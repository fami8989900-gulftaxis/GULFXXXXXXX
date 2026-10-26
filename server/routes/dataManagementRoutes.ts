import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { getDb, persistDb, queryAll, queryOne, runSql, runTransaction } from '../db.js';
import { requireAuth, requireRole, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// GET /api/data-management/summary
router.get('/summary', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM bookings')?.count || 0;
    const activeBookingsCount = queryOne<{ count: number }>(
      "SELECT count(*) as count FROM bookings WHERE trip_status NOT IN ('Trip Completed', 'Cancelled', 'No Show')"
    )?.count || 0;
    const tripLogsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM trip_status_logs')?.count || 0;
    const paymentsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM payments')?.count || 0;
    const driversCount = queryOne<{ count: number }>('SELECT count(*) as count FROM drivers')?.count || 0;
    const suppliersCount = queryOne<{ count: number }>('SELECT count(*) as count FROM suppliers')?.count || 0;
    const vehiclesCount = queryOne<{ count: number }>('SELECT count(*) as count FROM vehicles')?.count || 0;
    const usersCount = queryOne<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;
    const settingsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM settings')?.count || 0;
    const auditLogsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM audit_logs')?.count || 0;
    const backupsCount = queryOne<{ count: number }>('SELECT count(*) as count FROM backups')?.count || 0;

    return res.json({
      operational: {
        bookings: bookingsCount,
        active_bookings: activeBookingsCount,
        trip_status_logs: tripLogsCount,
        payments: paymentsCount,
        drivers: driversCount,
        suppliers: suppliersCount,
        vehicles: vehiclesCount,
      },
      protected: {
        users: usersCount,
        settings: settingsCount,
        audit_logs: auditLogsCount,
        backups: backupsCount,
      },
    });
  } catch (err: any) {
    console.error('Data summary error:', err);
    return res.status(500).json({ error: 'Failed to retrieve data summary: ' + err.message });
  }
});

// POST /api/data-management/fresh-start
router.post('/fresh-start', requireAuth, requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { password, confirmationPhrase, mode, categories } = req.body;

  // 1. Validate confirmation phrase
  if (!confirmationPhrase || confirmationPhrase.trim() !== 'RESET GULF TAXIS') {
    return res.status(400).json({
      error: 'Security confirmation failed. You must type exactly "RESET GULF TAXIS" to proceed.',
    });
  }

  // 2. Validate password
  if (!password) {
    return res.status(400).json({ error: 'Administrator password is required to authorize Fresh Start.' });
  }

  const currentUser = queryOne<{ password_hash: string; username: string; role: string }>(
    'SELECT password_hash, username, role FROM users WHERE id = ?',
    [req.user?.id]
  );

  if (!currentUser || !bcrypt.compareSync(password, currentUser.password_hash)) {
    return res.status(401).json({ error: 'Incorrect administrator password. Authentication failed.' });
  }

  // 3. Determine categories to clear
  const toClear = {
    bookings: false,
    drivers: false,
    suppliers: false,
    vehicles: false,
    payments: false,
  };

  if (mode === 'operational_reset') {
    toClear.bookings = true;
    toClear.payments = true;
    if (categories?.drivers) toClear.drivers = true;
    if (categories?.suppliers) toClear.suppliers = true;
    if (categories?.vehicles) toClear.vehicles = true;
  } else if (mode === 'selective_reset') {
    toClear.bookings = !!categories?.bookings;
    toClear.drivers = !!categories?.drivers;
    toClear.suppliers = !!categories?.suppliers;
    toClear.vehicles = !!categories?.vehicles;
    toClear.payments = !!categories?.payments;
  } else {
    return res.status(400).json({ error: 'Invalid Fresh Start mode specified.' });
  }

  const anySelected = Object.values(toClear).some(Boolean);
  if (!anySelected) {
    return res.status(400).json({ error: 'Please select at least one data category to reset.' });
  }

  // 4. STEP 1: Mandatory Full Database Snapshot BEFORE any deletion
  let backupFilename = '';
  try {
    const db = await getDb();
    persistDb(); // Ensure any pending state is written

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupFilename = `fresh_start_safety_backup_${timestamp}.sqlite`;
    const destPath = path.join(BACKUPS_DIR, backupFilename);

    const binaryData = db.export();
    const buffer = Buffer.from(binaryData);
    fs.writeFileSync(destPath, buffer);

    // Verify backup on disk
    if (!fs.existsSync(destPath) || fs.statSync(destPath).size < 1000) {
      throw new Error('Safety backup verification failed: snapshot file is missing or corrupted.');
    }

    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'automated')`,
      ['bkp_fresh_start_' + Date.now(), backupFilename, buffer.length, new Date().toISOString()]
    );
  } catch (backupErr: any) {
    console.error('Fresh Start aborted due to backup error:', backupErr);
    return res.status(500).json({
      error: `Safety backup creation failed (${backupErr.message}). Fresh Start has been aborted with ZERO changes made to your database.`,
    });
  }

  // 5. STEP 2: Execute deletions within an isolated SQLite transaction
  const deletedCounts: Record<string, number> = {};

  try {
    const db = await getDb();

    runTransaction(() => {
      // 1. Bookings & Trip status logs
      if (toClear.bookings) {
        const bCount = queryOne<{ count: number }>('SELECT count(*) as count FROM bookings')?.count || 0;
        const lCount = queryOne<{ count: number }>('SELECT count(*) as count FROM trip_status_logs')?.count || 0;

        db.run('DELETE FROM trip_status_logs;');
        // Also remove booking-attached payment vouchers if clearing bookings
        db.run('DELETE FROM payments WHERE booking_id IS NOT NULL;');
        db.run('DELETE FROM bookings;');

        deletedCounts.bookings = bCount;
        deletedCounts.trip_status_logs = lCount;
      }

      // 2. Drivers
      if (toClear.drivers) {
        const dCount = queryOne<{ count: number }>('SELECT count(*) as count FROM drivers')?.count || 0;

        db.run("DELETE FROM payments WHERE entity_type = 'driver_payment';");
        db.run('UPDATE vehicles SET assigned_driver_id = NULL;');
        db.run('UPDATE bookings SET driver_id = NULL;');
        db.run('DELETE FROM drivers;');

        deletedCounts.drivers = dCount;
      }

      // 3. Suppliers
      if (toClear.suppliers) {
        const sCount = queryOne<{ count: number }>('SELECT count(*) as count FROM suppliers')?.count || 0;

        db.run("DELETE FROM payments WHERE entity_type = 'supplier_payment';");
        db.run('UPDATE vehicles SET supplier_id = NULL;');
        db.run('UPDATE bookings SET supplier_id = NULL;');
        db.run('DELETE FROM suppliers;');

        deletedCounts.suppliers = sCount;
      }

      // 4. Vehicles
      if (toClear.vehicles) {
        const vCount = queryOne<{ count: number }>('SELECT count(*) as count FROM vehicles')?.count || 0;

        db.run('UPDATE drivers SET assigned_vehicle_id = NULL;');
        db.run('UPDATE bookings SET vehicle_id = NULL;');
        db.run('DELETE FROM vehicles;');

        deletedCounts.vehicles = vCount;
      }

      // 5. Payments (general expenses / remaining vouchers)
      if (toClear.payments) {
        const pCount = queryOne<{ count: number }>('SELECT count(*) as count FROM payments')?.count || 0;
        db.run('DELETE FROM payments;');
        deletedCounts.payments = pCount;
      }
    });

    // 6. Record immutable security audit log
    const affectedCategories = Object.keys(toClear).filter((k) => (toClear as any)[k]);
    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      'RESET',
      'system',
      'fresh_start',
      `Executed Fresh Start (${mode}). Cleared: ${affectedCategories.join(', ')}. Safety backup: ${backupFilename}`
    );

    return res.json({
      success: true,
      message: 'Fresh Start completed successfully. Selected operational data has been cleared.',
      backupFilename,
      deletedCounts,
      affectedCategories,
    });
  } catch (txErr: any) {
    console.error('Fresh Start transaction failed and rolled back:', txErr);
    return res.status(500).json({
      error: 'Database transaction failed during reset. All changes have been completely rolled back. Error: ' + txErr.message,
    });
  }
});

export default router;
