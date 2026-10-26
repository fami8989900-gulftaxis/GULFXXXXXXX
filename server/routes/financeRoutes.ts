import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// Helper to generate payment reference
function generatePaymentRef(type: string): string {
  const currentYear = new Date().getFullYear();
  let prefix = `PAY-${currentYear}-`;
  if (type === 'customer_receipt') prefix = `RCT-${currentYear}-`;
  else if (type === 'driver_payment') prefix = `DRV-PAY-${currentYear}-`;
  else if (type === 'supplier_payment') prefix = `SUP-PAY-${currentYear}-`;
  else if (type === 'general_expense') prefix = `EXP-${currentYear}-`;
  else if (type === 'refund_adjustment') prefix = `REF-${currentYear}-`;

  const rows = queryAll<{ payment_ref: string }>(
    `SELECT payment_ref FROM payments WHERE payment_ref LIKE ? ORDER BY payment_ref DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0 && rows[0].payment_ref) {
    const parts = rows[0].payment_ref.split('-');
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

// GET /api/finance/overview
router.get('/overview', requireAuth, requirePermission('payments'), (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;

  let bookingDateClause = '';
  const bookingParams: any[] = [];
  if (startDate) {
    bookingDateClause += ` AND pickup_date >= ?`;
    bookingParams.push(startDate);
  }
  if (endDate) {
    bookingDateClause += ` AND pickup_date <= ?`;
    bookingParams.push(endDate);
  }

  // Total booked revenue (non-cancelled)
  const revenueRow = queryOne(
    `SELECT 
      COALESCE(SUM(customer_price), 0) as total_booked_revenue,
      COALESCE(SUM(paid_amount), 0) as total_collected_revenue,
      COALESCE(SUM(customer_price - paid_amount), 0) as total_outstanding_receivable,
      COALESCE(SUM(supplier_cost), 0) as total_supplier_cost,
      COALESCE(SUM(driver_payout), 0) as total_driver_payout
    FROM bookings 
    WHERE trip_status != 'Cancelled' ${bookingDateClause}`,
    bookingParams
  );

  // Payments collected vs paid out
  let payDateClause = '';
  const payParams: any[] = [];
  if (startDate) {
    payDateClause += ` AND payment_date >= ?`;
    payParams.push(startDate);
  }
  if (endDate) {
    payDateClause += ` AND payment_date <= ?`;
    payParams.push(endDate);
  }

  const receiptsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_receipts FROM payments WHERE entity_type = 'customer_receipt' ${payDateClause}`,
    payParams
  );
  const driverPaymentsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_driver_paid FROM payments WHERE entity_type = 'driver_payment' ${payDateClause}`,
    payParams
  );
  const supplierPaymentsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_supplier_paid FROM payments WHERE entity_type = 'supplier_payment' ${payDateClause}`,
    payParams
  );
  const expensesRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_expenses FROM payments WHERE entity_type = 'general_expense' ${payDateClause}`,
    payParams
  );
  const refundsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_refunds FROM payments WHERE entity_type = 'refund_adjustment' ${payDateClause}`,
    payParams
  );

  // Overall Payables
  const totalEarnedDrivers = queryOne(
    `SELECT COALESCE(SUM(driver_payout), 0) as val FROM bookings WHERE trip_status = 'Trip Completed'`
  )?.val || 0;
  const totalPaidToDrivers = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as val FROM payments WHERE entity_type = 'driver_payment'`
  )?.val || 0;
  const driverOutstandingPayable = Math.max(0, totalEarnedDrivers - totalPaidToDrivers);

  const totalSupplierCosts = queryOne(
    `SELECT COALESCE(SUM(supplier_cost), 0) as val FROM bookings WHERE trip_status != 'Cancelled'`
  )?.val || 0;
  const supplierOpening = queryOne(
    `SELECT COALESCE(SUM(opening_balance), 0) as val FROM suppliers`
  )?.val || 0;
  const totalPaidToSuppliers = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as val FROM payments WHERE entity_type = 'supplier_payment'`
  )?.val || 0;
  const supplierOutstandingPayable = Math.max(0, totalSupplierCosts + supplierOpening - totalPaidToSuppliers);

  const totalRevenue = receiptsRow?.total_receipts || 0;
  const totalExpenses = (driverPaymentsRow?.total_driver_paid || 0) + (supplierPaymentsRow?.total_supplier_paid || 0) + (expensesRow?.total_expenses || 0) + (refundsRow?.total_refunds || 0);
  const netCashFlow = totalRevenue - totalExpenses;

  // Booked Profit calculation
  const bookedRevenue = revenueRow?.total_booked_revenue || 0;
  const directCosts = (revenueRow?.total_supplier_cost || 0) + (revenueRow?.total_driver_payout || 0) + (expensesRow?.total_expenses || 0);
  const grossProfit = bookedRevenue - directCosts;

  return res.json({
    metrics: {
      bookedRevenue,
      collectedRevenue: receiptsRow?.total_receipts || 0,
      outstandingReceivables: Math.max(0, bookedRevenue - (receiptsRow?.total_receipts || 0)),
      driverOutstandingPayable,
      supplierOutstandingPayable,
      totalExpenses,
      generalExpenses: expensesRow?.total_expenses || 0,
      netCashFlow,
      grossProfit,
      currency: 'SAR',
    },
  });
});

// GET /api/finance/payments
router.get('/payments', requireAuth, requirePermission('payments'), (req: AuthenticatedRequest, res: Response) => {
  const { type, startDate, endDate, bookingId, search, category, driverId, supplierId, currency } = req.query;

  let sql = `SELECT * FROM payments WHERE 1=1`;
  const params: any[] = [];

  if (type && type !== 'all') {
    sql += ` AND entity_type = ?`;
    params.push(type);
  }

  if (category && category !== 'all') {
    sql += ` AND expense_category = ?`;
    params.push(category);
  }

  if (driverId && driverId !== 'all') {
    sql += ` AND (entity_id = ? OR notes LIKE ?)`;
    params.push(driverId, `%${driverId}%`);
  }

  if (supplierId && supplierId !== 'all') {
    sql += ` AND (entity_id = ? OR notes LIKE ?)`;
    params.push(supplierId, `%${supplierId}%`);
  }

  if (currency && currency !== 'all') {
    sql += ` AND currency = ?`;
    params.push(currency);
  }

  if (startDate) {
    sql += ` AND payment_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND payment_date <= ?`;
    params.push(endDate);
  }

  if (bookingId) {
    sql += ` AND booking_id = ?`;
    params.push(bookingId);
  }

  if (search && typeof search === 'string') {
    const term = `%${search.trim()}%`;
    sql += ` AND (payment_ref LIKE ? OR entity_name LIKE ? OR reference_no LIKE ? OR notes LIKE ? OR booking_ref LIKE ? OR expense_category LIKE ?)`;
    params.push(term, term, term, term, term, term);
  }

  sql += ` ORDER BY payment_date DESC, created_at DESC LIMIT 500`;

  const payments = queryAll(sql, params);
  const totalAmount = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  return res.json({ payments, totalAmount });
});

// POST /api/finance/payments
router.post('/payments', requireAuth, requirePermission('payments'), (req: AuthenticatedRequest, res: Response) => {
  const {
    entity_type,
    entity_id,
    entity_name,
    booking_id,
    booking_ref,
    amount,
    currency,
    payment_method,
    payment_date,
    reference_no,
    notes,
    expense_category,
  } = req.body;

  if (!entity_type || !amount || !payment_method || !payment_date) {
    return res.status(400).json({ error: 'Please provide Transaction Type, Amount, Payment Method, and Payment Date.' });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Please provide a valid positive payment amount.' });
  }

  const id = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const payment_ref = generatePaymentRef(entity_type);
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO payments (
      id, payment_ref, entity_type, entity_id, entity_name, booking_id, booking_ref,
      amount, currency, payment_method, payment_date, reference_no, notes,
      expense_category, created_by_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payment_ref,
      entity_type,
      entity_id || null,
      entity_name || null,
      booking_id || null,
      booking_ref || null,
      numAmount,
      currency || 'SAR',
      payment_method,
      payment_date,
      reference_no || null,
      notes || null,
      expense_category || (entity_type === 'general_expense' ? 'General Operations' : null),
      req.user?.id,
      req.user?.full_name,
      now,
      now,
    ]
  );

  // If customer receipt for a specific booking, update booking paid_amount and payment_status
  if (entity_type === 'customer_receipt' && booking_id) {
    const booking = queryOne(`SELECT id, customer_price, paid_amount FROM bookings WHERE id = ?`, [booking_id]);
    if (booking) {
      const newPaid = Math.round(((booking.paid_amount || 0) + numAmount) * 100) / 100;
      let newPaymentStatus = 'partial';
      if (newPaid >= booking.customer_price) {
        newPaymentStatus = 'paid';
      } else if (newPaid <= 0) {
        newPaymentStatus = 'unpaid';
      }

      runSql(`UPDATE bookings SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?`, [
        newPaid,
        newPaymentStatus,
        now,
        booking_id,
      ]);
    }
  }

  // If driver payment, deduct from driver's cached current_balance
  if (entity_type === 'driver_payment' && entity_id) {
    runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [numAmount, entity_id]);
  }

  // If supplier payment, deduct from supplier's cached current_balance
  if (entity_type === 'supplier_payment' && entity_id) {
    runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [numAmount, entity_id]);
  }

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'PAYMENT',
    'payment',
    id,
    `Recorded ${entity_type}: ${numAmount} ${currency || 'SAR'} (${payment_ref})`
  );

  const created = queryOne(`SELECT * FROM payments WHERE id = ?`, [id]);
  return res.status(201).json({
    success: true,
    payment: created,
    message: `Payment ${payment_ref} for ${numAmount} ${currency || 'SAR'} successfully recorded.`,
  });
});

// PUT /api/finance/payments/:id
router.put('/payments/:id', requireAuth, requirePermission('payments'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction or expense record not found.' });
  }

  const {
    amount,
    currency,
    payment_method,
    payment_date,
    reference_no,
    notes,
    expense_category,
    entity_id,
    entity_name,
    booking_id,
    booking_ref,
  } = req.body;

  if (!amount || !payment_method || !payment_date) {
    return res.status(400).json({ error: 'Please provide Amount, Payment Method, and Payment Date.' });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Please provide a valid positive amount.' });
  }

  const now = new Date().toISOString();
  const amountDiff = numAmount - existing.amount;

  // If customer receipt with linked booking, adjust booking paid_amount
  if (existing.entity_type === 'customer_receipt' && existing.booking_id) {
    const booking = queryOne(`SELECT id, customer_price, paid_amount FROM bookings WHERE id = ?`, [existing.booking_id]);
    if (booking) {
      const newPaid = Math.round(((booking.paid_amount || 0) + amountDiff) * 100) / 100;
      let newPaymentStatus = 'partial';
      if (newPaid >= booking.customer_price) newPaymentStatus = 'paid';
      else if (newPaid <= 0) newPaymentStatus = 'unpaid';
      runSql(`UPDATE bookings SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?`, [newPaid, newPaymentStatus, now, existing.booking_id]);
    }
  }

  // If driver payment, adjust current_balance
  if (existing.entity_type === 'driver_payment' && existing.entity_id) {
    runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [amountDiff, existing.entity_id]);
  }

  // If supplier payment, adjust current_balance
  if (existing.entity_type === 'supplier_payment' && existing.entity_id) {
    runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [amountDiff, existing.entity_id]);
  }

  runSql(
    `UPDATE payments SET
      amount = ?,
      currency = ?,
      payment_method = ?,
      payment_date = ?,
      reference_no = ?,
      notes = ?,
      expense_category = ?,
      entity_id = ?,
      entity_name = ?,
      booking_id = ?,
      booking_ref = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      numAmount,
      currency || existing.currency,
      payment_method,
      payment_date,
      reference_no !== undefined ? reference_no : existing.reference_no,
      notes !== undefined ? notes : existing.notes,
      expense_category !== undefined ? expense_category : existing.expense_category,
      entity_id !== undefined ? entity_id : existing.entity_id,
      entity_name !== undefined ? entity_name : existing.entity_name,
      booking_id !== undefined ? booking_id : existing.booking_id,
      booking_ref !== undefined ? booking_ref : existing.booking_ref,
      now,
      existing.id,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'payment',
    existing.id,
    `Updated ${existing.entity_type} ${existing.payment_ref}: ${numAmount} ${currency || existing.currency}`
  );

  const updated = queryOne(`SELECT * FROM payments WHERE id = ?`, [existing.id]);
  return res.json({
    success: true,
    payment: updated,
    message: `Record '${existing.payment_ref}' successfully updated.`,
  });
});

// DELETE /api/finance/payments/:id
router.delete('/payments/:id', requireAuth, requirePermission('payments'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction or expense record not found.' });
  }

  // Protected financial records check
  if (existing.entity_type === 'customer_receipt' && existing.booking_id) {
    const b = queryOne(`SELECT id, booking_ref FROM bookings WHERE id = ?`, [existing.booking_id]);
    if (b) {
      return res.status(400).json({
        error: `Cannot directly delete customer receipt '${existing.payment_ref}' because it is linked to active booking '${b.booking_ref}'. Please edit the receipt amount or issue an adjustment entry to maintain audit integrity.`,
      });
    }
  }

  if (existing.entity_type === 'driver_payment' && existing.entity_id) {
    return res.status(400).json({
      error: `Cannot delete driver payout '${existing.payment_ref}' as it is an established ledger transaction on the driver's statement. Please edit the payment or issue an adjustment entry.`,
    });
  }

  if (existing.entity_type === 'supplier_payment' && existing.entity_id) {
    return res.status(400).json({
      error: `Cannot delete supplier payout '${existing.payment_ref}' as it is part of the partner's recorded statement. Please edit or adjust the transaction instead.`,
    });
  }

  // Permitted deletion (general expenses, standalone expense entries)
  runSql(`DELETE FROM payments WHERE id = ?`, [existing.id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'DELETE',
    'payment',
    existing.id,
    `Deleted expense/transaction ${existing.payment_ref} (${existing.amount} ${existing.currency})`
  );

  return res.json({
    success: true,
    message: `Expense '${existing.payment_ref}' successfully deleted.`,
  });
});

// GET /api/finance/receipt/:id
router.get('/receipt/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const payment = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!payment) {
    return res.status(404).json({ error: 'Payment receipt not found.' });
  }

  let booking = null;
  if (payment.booking_id) {
    booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [payment.booking_id]);
  }

  const companySetting = queryOne(`SELECT value FROM settings WHERE key = 'company_profile'`);
  const companyProfile = companySetting ? JSON.parse(companySetting.value) : {};

  return res.json({
    receipt: payment,
    booking,
    company: companyProfile,
  });
});

export default router;
