import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/suppliers
router.get('/', requireAuth, requirePermission('suppliers'), (req: AuthenticatedRequest, res: Response) => {
  const { search, status } = req.query;

  let sql = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM bookings WHERE supplier_id = s.id) as total_bookings_count,
      (SELECT COUNT(*) FROM vehicles WHERE supplier_id = s.id) as fleet_vehicles_count
    FROM suppliers s
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string') {
    sql += ` AND (s.name LIKE ? OR s.contact_person LIKE ? OR s.supplier_code LIKE ? OR s.mobile LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (status === 'active') {
    sql += ` AND s.is_active = 1`;
  } else if (status === 'inactive') {
    sql += ` AND s.is_active = 0`;
  }

  sql += ` ORDER BY s.name ASC`;

  const suppliers = queryAll(sql, params);
  return res.json({ suppliers });
});

// GET /api/suppliers/:id
router.get('/:id', requireAuth, requirePermission('suppliers'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const supplier = queryOne(`SELECT * FROM suppliers WHERE id = ? OR supplier_code = ?`, [id, id]);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  // Trip history
  const trips = queryAll(
    `SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg 
     FROM bookings b 
     LEFT JOIN drivers d ON b.driver_id = d.id 
     LEFT JOIN vehicles v ON b.vehicle_id = v.id 
     WHERE b.supplier_id = ? 
     ORDER BY b.pickup_date DESC, b.pickup_time DESC`,
    [supplier.id]
  );

  // Payment history
  const payments = queryAll(
    `SELECT * FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [supplier.id]
  );

  // Live payable calculation
  const costRow = queryOne(
    `SELECT COALESCE(SUM(supplier_cost), 0) as total_payable FROM bookings WHERE supplier_id = ? AND trip_status != 'Cancelled'`,
    [supplier.id]
  );
  const paidRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ?`,
    [supplier.id]
  );

  const totalPayable = (costRow?.total_payable || 0) + (supplier.opening_balance || 0);
  const totalPaid = paidRow?.total_paid || 0;
  const outstandingBalance = Math.round((totalPayable - totalPaid) * 100) / 100;

  return res.json({
    supplier,
    trips,
    payments,
    financials: {
      openingBalance: supplier.opening_balance,
      totalPayable,
      totalPaid,
      outstandingBalance,
    },
  });
});

// POST /api/suppliers
router.post('/', requireAuth, requirePermission('suppliers'), (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    contact_person,
    mobile,
    email,
    address,
    default_currency,
    opening_balance,
    payment_terms,
    notes,
  } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ error: 'Please provide Supplier / Company Name and Contact Mobile Number.' });
  }

  // Generate code
  const lastCode = queryOne<{ supplier_code: string }>(`SELECT supplier_code FROM suppliers ORDER BY supplier_code DESC LIMIT 1`);
  let codeNum = 1;
  if (lastCode && lastCode.supplier_code) {
    const parsed = parseInt(lastCode.supplier_code.replace('SUP-', ''), 10);
    if (!isNaN(parsed)) codeNum = parsed + 1;
  }
  const supplier_code = `SUP-${codeNum.toString().padStart(2, '0')}`;

  const id = 'sup_' + Date.now();
  const now = new Date().toISOString();
  const openBal = parseFloat(opening_balance) || 0;

  runSql(
    `INSERT INTO suppliers (
      id, supplier_code, name, contact_person, mobile, email, address,
      default_currency, opening_balance, current_balance, payment_terms, is_active, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      id,
      supplier_code,
      name.trim(),
      contact_person?.trim() || null,
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
      default_currency || 'SAR',
      openBal,
      openBal,
      payment_terms || '15_days',
      notes || null,
      now,
      now,
    ]
  );

  recordAuditLog(req.user?.id, req.user?.full_name, 'CREATE', 'supplier', id, `Added supplier ${name} (${supplier_code})`);

  const created = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, supplier: created, message: `Supplier ${name} created successfully.` });
});

// PUT /api/suppliers/:id
router.put('/:id', requireAuth, requirePermission('suppliers'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const {
    name,
    contact_person,
    mobile,
    email,
    address,
    default_currency,
    opening_balance,
    payment_terms,
    is_active,
    notes,
  } = req.body;

  const now = new Date().toISOString();

  runSql(
    `UPDATE suppliers SET
      name = ?,
      contact_person = ?,
      mobile = ?,
      email = ?,
      address = ?,
      default_currency = ?,
      opening_balance = ?,
      payment_terms = ?,
      is_active = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      name ? name.trim() : existing.name,
      contact_person !== undefined ? (contact_person ? contact_person.trim() : null) : existing.contact_person,
      mobile ? mobile.trim() : existing.mobile,
      email !== undefined ? (email ? email.trim() : null) : existing.email,
      address !== undefined ? (address ? address.trim() : null) : existing.address,
      default_currency || existing.default_currency,
      opening_balance !== undefined ? parseFloat(opening_balance) : existing.opening_balance,
      payment_terms || existing.payment_terms,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      notes !== undefined ? notes : existing.notes,
      now,
      id,
    ]
  );

  recordAuditLog(req.user?.id, req.user?.full_name, 'UPDATE', 'supplier', id, `Updated supplier ${existing.supplier_code}`);

  const updated = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return res.json({ success: true, supplier: updated, message: `Supplier ${updated.name} updated successfully.` });
});

// GET /api/suppliers/:id/statement
router.get('/:id/statement', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const supplier = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  let tripSql = `SELECT id, booking_ref, pickup_date, pickup_time, pickup_location, dropoff_location, passenger_name, supplier_cost, currency, trip_status 
                 FROM bookings WHERE supplier_id = ? AND trip_status != 'Cancelled'`;
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
                FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ?`;
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

  type StatementEntry = {
    date: string;
    reference: string;
    type: 'Trip Purchase' | 'Supplier Payment';
    description: string;
    payable: number;
    paid: number;
    balance: number;
    currency: string;
  };

  const entries: StatementEntry[] = [];
  let runningBalance = supplier.opening_balance || 0;

  for (const t of trips) {
    runningBalance += t.supplier_cost;
    entries.push({
      date: `${t.pickup_date} ${t.pickup_time}`,
      reference: t.booking_ref,
      type: 'Trip Purchase',
      description: `${t.passenger_name} (${t.pickup_location} → ${t.dropoff_location})`,
      payable: t.supplier_cost,
      paid: 0,
      balance: runningBalance,
      currency: t.currency || 'SAR',
    });
  }

  for (const p of payments) {
    runningBalance -= p.amount;
    entries.push({
      date: p.payment_date,
      reference: p.payment_ref,
      type: 'Supplier Payment',
      description: `Payment via ${p.payment_method} (${p.reference_no || 'No ref'})`,
      payable: 0,
      paid: p.amount,
      balance: runningBalance,
      currency: p.currency || 'SAR',
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let seqBalance = supplier.opening_balance || 0;
  for (const entry of entries) {
    seqBalance += entry.payable - entry.paid;
    entry.balance = Math.round(seqBalance * 100) / 100;
  }

  return res.json({
    supplier,
    openingBalance: supplier.opening_balance || 0,
    statementPeriod: {
      startDate: startDate || 'All Time',
      endDate: endDate || 'Present',
    },
    entries,
    summary: {
      totalPayable: entries.reduce((s, e) => s + e.payable, 0),
      totalPaid: entries.reduce((s, e) => s + e.paid, 0),
      closingBalance: seqBalance,
    },
  });
});

export default router;
