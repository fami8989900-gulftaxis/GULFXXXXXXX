import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requireRole, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/drivers
router.get('/', requireAuth, requirePermission('drivers'), (req: AuthenticatedRequest, res: Response) => {
  const { search, status } = req.query;

  let sql = `
    SELECT 
      d.*,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id) as total_bookings_count,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id AND trip_status = 'Trip Completed') as completed_trips_count,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id AND trip_status NOT IN ('Trip Completed', 'Cancelled', 'No Show')) as active_trips_count,
      (SELECT COUNT(*) FROM payments WHERE entity_type = 'driver_payment' AND entity_id = d.id) as payments_count,
      ((SELECT COALESCE(SUM(driver_payout), 0) FROM bookings WHERE driver_id = d.id AND trip_status = 'Trip Completed') - 
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE entity_type = 'driver_payment' AND entity_id = d.id)) as calculated_balance
    FROM drivers d
    LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string') {
    sql += ` AND (d.full_name LIKE ? OR d.mobile LIKE ? OR d.driver_code LIKE ? OR d.license_number LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (status === 'active') {
    sql += ` AND d.is_active = 1`;
  } else if (status === 'inactive') {
    sql += ` AND d.is_active = 0`;
  }

  sql += ` ORDER BY d.full_name ASC`;

  const drivers = queryAll(sql, params);
  return res.json({ drivers });
});

// GET /api/drivers/:id
router.get('/:id', requireAuth, requirePermission('drivers'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const driver = queryOne(
    `SELECT d.*, v.reg_number as vehicle_reg, v.make_model as vehicle_model 
     FROM drivers d 
     LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id 
     WHERE d.id = ? OR d.driver_code = ?`,
    [id, id]
  );

  if (!driver) {
    return res.status(404).json({ error: 'Driver not found.' });
  }

  // Trip history
  const trips = queryAll(
    `SELECT * FROM bookings WHERE driver_id = ? ORDER BY pickup_date DESC, pickup_time DESC`,
    [driver.id]
  );

  // Payment history
  const payments = queryAll(
    `SELECT * FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [driver.id]
  );

  // Calculate live payable balance = sum(driver_payout for completed trips) - sum(amount from payments)
  const earnedRow = queryOne(
    `SELECT COALESCE(SUM(driver_payout), 0) as total_earned FROM bookings WHERE driver_id = ? AND trip_status = 'Trip Completed'`,
    [driver.id]
  );
  const paidRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`,
    [driver.id]
  );

  const totalEarned = earnedRow?.total_earned || 0;
  const totalPaid = paidRow?.total_paid || 0;
  const calculatedBalance = Math.round((totalEarned - totalPaid) * 100) / 100;

  return res.json({
    driver,
    trips,
    payments,
    financials: {
      totalEarned,
      totalPaid,
      outstandingBalance: calculatedBalance,
    },
  });
});

// POST /api/drivers
router.post('/', requireAuth, requirePermission('drivers'), (req: AuthenticatedRequest, res: Response) => {
  const {
    full_name,
    mobile,
    email,
    license_number,
    license_expiry,
    assigned_vehicle_id,
    payment_arrangement,
    rate_or_salary,
    currency,
    notes,
  } = req.body;

  if (!full_name || !mobile || !license_number || !license_expiry) {
    return res.status(400).json({ error: 'Please provide full name, mobile number, license number, and license expiry.' });
  }

  // Generate driver code
  const lastDriver = queryOne<{ driver_code: string }>(`SELECT driver_code FROM drivers ORDER BY driver_code DESC LIMIT 1`);
  let codeNum = 101;
  if (lastDriver && lastDriver.driver_code) {
    const parsed = parseInt(lastDriver.driver_code.replace('DRV-', ''), 10);
    if (!isNaN(parsed)) codeNum = parsed + 1;
  }
  const driver_code = `DRV-${codeNum}`;

  const id = 'drv_' + Date.now();
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO drivers (
      id, driver_code, full_name, mobile, email, license_number, license_expiry,
      assigned_vehicle_id, payment_arrangement, rate_or_salary, currency, is_active,
      current_balance, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    [
      id,
      driver_code,
      full_name.trim(),
      mobile.trim(),
      email?.trim() || null,
      license_number.trim(),
      license_expiry,
      assigned_vehicle_id || null,
      payment_arrangement || 'per_trip',
      parseFloat(rate_or_salary) || 0,
      currency || 'SAR',
      notes || null,
      now,
      now,
    ]
  );

  // Synchronize two-way link to vehicle
  if (assigned_vehicle_id) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = ? AND id != ?`, [assigned_vehicle_id, id]);
    runSql(`UPDATE vehicles SET assigned_driver_id = ? WHERE id = ?`, [id, assigned_vehicle_id]);
  }

  recordAuditLog(req.user?.id, req.user?.full_name, 'CREATE', 'driver', id, `Added driver ${full_name} (${driver_code})`);

  const created = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, driver: created, message: `Driver ${full_name} successfully added.` });
});

// PUT /api/drivers/:id
router.put('/:id', requireAuth, requirePermission('drivers'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Driver not found.' });
  }

  const {
    full_name,
    mobile,
    email,
    license_number,
    license_expiry,
    assigned_vehicle_id,
    payment_arrangement,
    rate_or_salary,
    currency,
    is_active,
    notes,
  } = req.body;

  const now = new Date().toISOString();
  const targetVehicleId = assigned_vehicle_id !== undefined ? assigned_vehicle_id : existing.assigned_vehicle_id;

  runSql(
    `UPDATE drivers SET
      full_name = ?,
      mobile = ?,
      email = ?,
      license_number = ?,
      license_expiry = ?,
      assigned_vehicle_id = ?,
      payment_arrangement = ?,
      rate_or_salary = ?,
      currency = ?,
      is_active = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      full_name ? full_name.trim() : existing.full_name,
      mobile ? mobile.trim() : existing.mobile,
      email !== undefined ? (email ? email.trim() : null) : existing.email,
      license_number ? license_number.trim() : existing.license_number,
      license_expiry || existing.license_expiry,
      targetVehicleId || null,
      payment_arrangement || existing.payment_arrangement,
      rate_or_salary !== undefined ? parseFloat(rate_or_salary) : existing.rate_or_salary,
      currency || existing.currency,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      notes !== undefined ? notes : existing.notes,
      now,
      id,
    ]
  );

  // Synchronize two-way link to vehicle
  if (existing.assigned_vehicle_id && existing.assigned_vehicle_id !== targetVehicleId) {
    runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE id = ? AND assigned_driver_id = ?`, [existing.assigned_vehicle_id, id]);
  }
  if (targetVehicleId) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = ? AND id != ?`, [targetVehicleId, id]);
    runSql(`UPDATE vehicles SET assigned_driver_id = ? WHERE id = ?`, [id, targetVehicleId]);
  }

  recordAuditLog(req.user?.id, req.user?.full_name, 'UPDATE', 'driver', id, `Updated driver ${existing.driver_code}`);

  const updated = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  return res.json({ success: true, driver: updated, message: `Driver ${updated.full_name} updated successfully.` });
});

// GET /api/drivers/:id/statement
router.get('/:id/statement', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const driver = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found.' });
  }

  let tripSql = `SELECT id, booking_ref, pickup_date, pickup_time, pickup_location, dropoff_location, driver_payout, currency, trip_status 
                 FROM bookings WHERE driver_id = ? AND trip_status = 'Trip Completed'`;
  const tripParams: any[] = [id];

  if (startDate) {
    tripSql += ` AND pickup_date >= ?`;
    tripParams.push(startDate);
  }
  if (endDate) {
    tripSql += ` AND pickup_date <= ?`;
    tripParams.push(endDate);
  }
  tripSql += ` ORDER BY pickup_date ASC, pickup_time ASC`;

  const trips = queryAll(tripSql, tripParams);

  let paySql = `SELECT id, payment_ref, payment_date, amount, currency, payment_method, reference_no, notes 
                FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`;
  const payParams: any[] = [id];

  if (startDate) {
    paySql += ` AND payment_date >= ?`;
    payParams.push(startDate);
  }
  if (endDate) {
    paySql += ` AND payment_date <= ?`;
    payParams.push(endDate);
  }
  paySql += ` ORDER BY payment_date ASC`;

  const payments = queryAll(paySql, payParams);

  // Combine chronologically to generate statement rows
  type StatementEntry = {
    date: string;
    reference: string;
    type: 'Trip Earned' | 'Payment Paid';
    description: string;
    payable: number;
    paid: number;
    balance: number;
    currency: string;
  };

  const entries: StatementEntry[] = [];
  let runningBalance = 0;

  // Add trips as credit (payable)
  for (const t of trips) {
    runningBalance += t.driver_payout;
    entries.push({
      date: `${t.pickup_date} ${t.pickup_time}`,
      reference: t.booking_ref,
      type: 'Trip Earned',
      description: `${t.pickup_location} → ${t.dropoff_location}`,
      payable: t.driver_payout,
      paid: 0,
      balance: runningBalance,
      currency: t.currency || 'SAR',
    });
  }

  // Add payments as debit (paid)
  for (const p of payments) {
    runningBalance -= p.amount;
    entries.push({
      date: p.payment_date,
      reference: p.payment_ref,
      type: 'Payment Paid',
      description: `Payment via ${p.payment_method} (${p.reference_no || 'No ref'})`,
      payable: 0,
      paid: p.amount,
      balance: runningBalance,
      currency: p.currency || 'SAR',
    });
  }

  // Sort by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Recalculate running balance in exact chronological sequence
  let seqBalance = 0;
  for (const entry of entries) {
    seqBalance += entry.payable - entry.paid;
    entry.balance = Math.round(seqBalance * 100) / 100;
  }

  return res.json({
    driver,
    statementPeriod: {
      startDate: startDate || 'All Time',
      endDate: endDate || 'Present',
    },
    entries,
    summary: {
      totalEarned: entries.reduce((s, e) => s + e.payable, 0),
      totalPaid: entries.reduce((s, e) => s + e.paid, 0),
      closingBalance: seqBalance,
    },
  });
});

// DELETE /api/drivers/:id
router.delete('/:id', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM drivers WHERE id = ? OR driver_code = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: 'Chauffeur not found.' });
  }

  // Check dependent records (any bookings or payment records)
  const bookingsCount = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bookings WHERE driver_id = ?`, [existing.id])?.count || 0;
  const paymentsCount = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`, [existing.id])?.count || 0;

  if (bookingsCount > 0 || paymentsCount > 0) {
    return res.status(400).json({
      hasDependencies: true,
      counts: {
        bookings: bookingsCount,
        payments: paymentsCount,
      },
      error: `Cannot permanently delete chauffeur '${existing.full_name}' because they have active records: ` +
        `[${bookingsCount} booking(s), ${paymentsCount} payment transaction(s)]. ` +
        `Please deactivate this driver instead to preserve trip records and financial audits.`,
    });
  }

  // Clear vehicle assignment if any vehicle is assigned to this driver
  runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ?`, [existing.id]);

  // Permanently delete driver and persist to SQLite
  runSql(`DELETE FROM drivers WHERE id = ?`, [existing.id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'DELETE',
    'driver',
    existing.id,
    `Permanently deleted driver ${existing.full_name} (${existing.driver_code})`
  );

  return res.json({
    success: true,
    message: `Chauffeur '${existing.full_name}' (${existing.driver_code}) successfully deleted.`,
  });
});

export default router;
