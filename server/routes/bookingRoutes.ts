import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// Helper to generate next unique booking ref
function generateBookingRef(): string {
  const currentYear = new Date().getFullYear();
  const prefix = `GT-${currentYear}-`;
  
  // Find highest reference number with prefix
  const rows = queryAll<{ booking_ref: string }>(
    `SELECT booking_ref FROM bookings WHERE booking_ref LIKE ? ORDER BY booking_ref DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0 && rows[0].booking_ref) {
    const parts = rows[0].booking_ref.split('-');
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  // Format with 4 digits padding
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

// GET /api/bookings
router.get('/', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const {
    search,
    status,
    startDate,
    endDate,
    driverId,
    supplierId,
    vehicleId,
    vehicleType,
    flightNumber,
    paymentStatus,
    limit,
    offset,
  } = req.query;

  let sql = `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string' && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    sql += ` AND (
      b.booking_ref LIKE ? OR 
      b.passenger_name LIKE ? OR 
      b.contact_number LIKE ? OR 
      b.pickup_location LIKE ? OR 
      b.dropoff_location LIKE ? OR 
      b.customer_name LIKE ? OR 
      b.flight_number LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  if (status && status !== 'all') {
    sql += ` AND b.trip_status = ?`;
    params.push(status);
  }

  if (startDate) {
    sql += ` AND b.pickup_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND b.pickup_date <= ?`;
    params.push(endDate);
  }

  if (driverId && driverId !== 'all') {
    sql += ` AND b.driver_id = ?`;
    params.push(driverId);
  }

  if (supplierId && supplierId !== 'all') {
    sql += ` AND b.supplier_id = ?`;
    params.push(supplierId);
  }

  if (vehicleId && vehicleId !== 'all') {
    sql += ` AND b.vehicle_id = ?`;
    params.push(vehicleId);
  }

  if (vehicleType && vehicleType !== 'all') {
    sql += ` AND b.vehicle_type = ?`;
    params.push(vehicleType);
  }

  if (flightNumber) {
    sql += ` AND b.flight_number LIKE ?`;
    params.push(`%${flightNumber}%`);
  }

  if (paymentStatus && paymentStatus !== 'all') {
    sql += ` AND b.payment_status = ?`;
    params.push(paymentStatus);
  }

  sql += ` ORDER BY b.pickup_date DESC, b.pickup_time DESC`;

  const parsedLimit = limit ? parseInt(limit as string, 10) : 500;
  sql += ` LIMIT ${parsedLimit}`;

  if (offset) {
    sql += ` OFFSET ${parseInt(offset as string, 10)}`;
  }

  const bookings = queryAll(sql, params);
  return res.json({ bookings, count: bookings.length });
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const booking = queryOne(
    `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.id = ? OR b.booking_ref = ?
  `,
    [id, id]
  );

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  // Get status history
  const statusHistory = queryAll(
    `SELECT * FROM trip_status_logs WHERE booking_id = ? ORDER BY timestamp DESC`,
    [booking.id]
  );

  // Get payment history
  const payments = queryAll(
    `SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [booking.id]
  );

  return res.json({
    booking,
    statusHistory,
    payments,
  });
});

// POST /api/bookings
router.post('/', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const {
    booking_date,
    pickup_date,
    pickup_time,
    passenger_name,
    contact_number,
    passengers_count,
    luggage_count,
    pickup_location,
    dropoff_location,
    flight_number,
    airline,
    vehicle_type,
    vehicle_id,
    driver_id,
    supplier_id,
    customer_name,
    customer_phone,
    customer_price,
    supplier_cost,
    driver_payout,
    currency,
    payment_status,
    paid_amount,
    trip_status,
    special_instructions,
    dispatcher_notes,
    supplier_reference,
  } = req.body;

  // Validation
  if (!pickup_date || !pickup_time || !passenger_name || !contact_number || !pickup_location || !dropoff_location) {
    return res.status(400).json({
      error: 'Please fill in all required fields: Pickup Date, Pickup Time, Passenger Name, Contact Number, Pickup Location, and Drop-off Location.',
    });
  }

  // Derive customer_name gracefully from supplier or passenger if omitted
  let effectiveCustomerName = customer_name ? customer_name.trim() : '';
  if (!effectiveCustomerName) {
    if (supplier_id) {
      const s = queryOne<{ name: string }>('SELECT name FROM suppliers WHERE id = ?', [supplier_id]);
      effectiveCustomerName = s?.name ? `Supplier: ${s.name}` : 'Direct Client';
    } else {
      effectiveCustomerName = passenger_name.trim();
    }
  }

  // Validate active driver and vehicle status
  if (driver_id) {
    const drv = queryOne<{ full_name: string; is_active: number }>('SELECT full_name, is_active FROM drivers WHERE id = ?', [driver_id]);
    if (drv && drv.is_active === 0) {
      return res.status(400).json({ error: `Driver ${drv.full_name} is marked as inactive and cannot receive new assignments.` });
    }
  }
  if (vehicle_id) {
    const veh = queryOne<{ reg_number: string; status: string }>('SELECT reg_number, status FROM vehicles WHERE id = ?', [vehicle_id]);
    if (veh && veh.status === 'inactive') {
      return res.status(400).json({ error: `Vehicle ${veh.reg_number} is marked as inactive and cannot receive new assignments.` });
    }
  }

  const effectiveVehicleType = vehicle_type || 'Sedan (Camry / Lexus ES)';

  // Check accidental duplicate submission within past 2 minutes with identical passenger and pickup date/time
  const duplicateCheck = queryOne(
    `SELECT id, booking_ref FROM bookings 
     WHERE LOWER(passenger_name) = LOWER(?) 
       AND pickup_date = ? 
       AND pickup_time = ? 
       AND LOWER(pickup_location) = LOWER(?)
     LIMIT 1`,
    [passenger_name.trim(), pickup_date, pickup_time, pickup_location.trim()]
  );

  if (duplicateCheck) {
    return res.status(409).json({
      error: `A matching booking already exists (${duplicateCheck.booking_ref}) for this passenger, date, and pickup location. If this is intentional, modify the time or special notes.`,
      duplicateBookingRef: duplicateCheck.booking_ref,
    });
  }

  const id = 'bk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const booking_ref = generateBookingRef();
  const now = new Date().toISOString();
  const actualBookingDate = booking_date || now.split('T')[0];

  const initialStatus = trip_status || (driver_id ? 'Assigned' : 'Awaiting Assignment');

  runSql(
    `INSERT INTO bookings (
      id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
      passengers_count, luggage_count, pickup_location, dropoff_location, flight_number, airline,
      vehicle_type, vehicle_id, driver_id, supplier_id, customer_name, customer_phone,
      customer_price, supplier_cost, driver_payout, currency, payment_status, paid_amount,
      trip_status, special_instructions, dispatcher_notes, supplier_reference,
      created_by_id, created_by_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`,
    [
      id,
      booking_ref,
      actualBookingDate,
      pickup_date,
      pickup_time,
      passenger_name.trim(),
      contact_number.trim(),
      parseInt(passengers_count, 10) || 1,
      parseInt(luggage_count, 10) || 0,
      pickup_location.trim(),
      dropoff_location.trim(),
      flight_number?.trim() || null,
      airline?.trim() || null,
      effectiveVehicleType,
      vehicle_id || null,
      driver_id || null,
      supplier_id || null,
      effectiveCustomerName,
      customer_phone?.trim() || null,
      parseFloat(customer_price) || 0,
      parseFloat(supplier_cost) || 0,
      parseFloat(driver_payout) || 0,
      currency || 'SAR',
      payment_status || 'unpaid',
      parseFloat(paid_amount) || 0,
      initialStatus,
      special_instructions || null,
      dispatcher_notes || null,
      supplier_reference?.trim() || null,
      req.user?.id || 'system',
      req.user?.full_name || 'System User',
      now,
      now,
    ]
  );

  // Status log
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_' + Date.now(),
      id,
      booking_ref,
      'New Booking',
      initialStatus,
      req.user?.id,
      req.user?.full_name,
      'Initial booking creation',
      now,
    ]
  );

  // If driver assigned, update driver status if needed
  if (driver_id && vehicle_id) {
    runSql(`UPDATE vehicles SET status = 'on_trip' WHERE id = ?`, [vehicle_id]);
  }

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CREATE',
    'booking',
    id,
    `Created booking ${booking_ref} for ${passenger_name} (${pickup_date} ${pickup_time})`
  );

  const createdBooking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  return res.status(201).json({
    success: true,
    message: `Booking ${booking_ref} successfully created and saved.`,
    booking: createdBooking,
  });
});

// PUT /api/bookings/:id
router.put('/:id', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const {
    booking_date,
    pickup_date,
    pickup_time,
    passenger_name,
    contact_number,
    passengers_count,
    luggage_count,
    pickup_location,
    dropoff_location,
    flight_number,
    airline,
    vehicle_type,
    vehicle_id,
    driver_id,
    supplier_id,
    customer_name,
    customer_phone,
    customer_price,
    supplier_cost,
    driver_payout,
    currency,
    payment_status,
    paid_amount,
    trip_status,
    special_instructions,
    dispatcher_notes,
    cancellation_reason,
    supplier_reference,
  } = req.body;

  // Validate active driver and vehicle status if changed
  if (driver_id && driver_id !== existing.driver_id) {
    const drv = queryOne<{ full_name: string; is_active: number }>('SELECT full_name, is_active FROM drivers WHERE id = ?', [driver_id]);
    if (drv && drv.is_active === 0) {
      return res.status(400).json({ error: `Driver ${drv.full_name} is marked as inactive and cannot receive new assignments.` });
    }
  }
  if (vehicle_id && vehicle_id !== existing.vehicle_id) {
    const veh = queryOne<{ reg_number: string; status: string }>('SELECT reg_number, status FROM vehicles WHERE id = ?', [vehicle_id]);
    if (veh && veh.status === 'inactive') {
      return res.status(400).json({ error: `Vehicle ${veh.reg_number} is marked as inactive and cannot receive new assignments.` });
    }
  }

  const now = new Date().toISOString();

  // Check if status changed
  const newStatus = trip_status || existing.trip_status;
  if (newStatus !== existing.trip_status) {
    runSql(
      `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'log_' + Date.now(),
        id,
        existing.booking_ref,
        existing.trip_status,
        newStatus,
        req.user?.id,
        req.user?.full_name,
        cancellation_reason || dispatcher_notes || 'Status updated via booking edit',
        now,
      ]
    );
  }

  runSql(
    `UPDATE bookings SET
      booking_date = ?,
      pickup_date = ?,
      pickup_time = ?,
      passenger_name = ?,
      contact_number = ?,
      passengers_count = ?,
      luggage_count = ?,
      pickup_location = ?,
      dropoff_location = ?,
      flight_number = ?,
      airline = ?,
      vehicle_type = ?,
      vehicle_id = ?,
      driver_id = ?,
      supplier_id = ?,
      customer_name = ?,
      customer_phone = ?,
      customer_price = ?,
      supplier_cost = ?,
      driver_payout = ?,
      currency = ?,
      payment_status = ?,
      paid_amount = ?,
      trip_status = ?,
      special_instructions = ?,
      dispatcher_notes = ?,
      cancellation_reason = ?,
      supplier_reference = ?,
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      booking_date || existing.booking_date,
      pickup_date || existing.pickup_date,
      pickup_time || existing.pickup_time,
      passenger_name ? passenger_name.trim() : existing.passenger_name,
      contact_number ? contact_number.trim() : existing.contact_number,
      parseInt(passengers_count, 10) || existing.passengers_count,
      parseInt(luggage_count, 10) || existing.luggage_count,
      pickup_location ? pickup_location.trim() : existing.pickup_location,
      dropoff_location ? dropoff_location.trim() : existing.dropoff_location,
      flight_number !== undefined ? flight_number : existing.flight_number,
      airline !== undefined ? airline : existing.airline,
      vehicle_type || existing.vehicle_type,
      vehicle_id !== undefined ? vehicle_id : existing.vehicle_id,
      driver_id !== undefined ? driver_id : existing.driver_id,
      supplier_id !== undefined ? supplier_id : existing.supplier_id,
      customer_name ? customer_name.trim() : existing.customer_name,
      customer_phone !== undefined ? customer_phone : existing.customer_phone,
      customer_price !== undefined ? parseFloat(customer_price) : existing.customer_price,
      supplier_cost !== undefined ? parseFloat(supplier_cost) : existing.supplier_cost,
      driver_payout !== undefined ? parseFloat(driver_payout) : existing.driver_payout,
      currency || existing.currency,
      payment_status || existing.payment_status,
      paid_amount !== undefined ? parseFloat(paid_amount) : existing.paid_amount,
      newStatus,
      special_instructions !== undefined ? special_instructions : existing.special_instructions,
      dispatcher_notes !== undefined ? dispatcher_notes : existing.dispatcher_notes,
      cancellation_reason !== undefined ? cancellation_reason : existing.cancellation_reason,
      supplier_reference !== undefined ? supplier_reference : existing.supplier_reference,
      req.user?.id,
      req.user?.full_name,
      now,
      id,
    ]
  );

  // Financial and vehicle status reconciliation on status change
  if (newStatus !== existing.trip_status) {
    // If completing trip, credit driver and supplier payable balances
    if (newStatus === 'Trip Completed' && existing.trip_status !== 'Trip Completed') {
      const effDriverId = driver_id !== undefined ? driver_id : existing.driver_id;
      const effPayout = driver_payout !== undefined ? parseFloat(driver_payout) : existing.driver_payout;
      if (effDriverId && effPayout > 0) {
        runSql(`UPDATE drivers SET current_balance = current_balance + ? WHERE id = ?`, [effPayout, effDriverId]);
      }
      const effSupplierId = supplier_id !== undefined ? supplier_id : existing.supplier_id;
      const effCost = supplier_cost !== undefined ? parseFloat(supplier_cost) : existing.supplier_cost;
      if (effSupplierId && effCost > 0) {
        runSql(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`, [effCost, effSupplierId]);
      }
      const effVehId = vehicle_id !== undefined ? vehicle_id : existing.vehicle_id;
      if (effVehId) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    }
    // If reverting from Trip Completed to Cancelled or other status
    else if (existing.trip_status === 'Trip Completed' && newStatus !== 'Trip Completed') {
      if (existing.driver_id && existing.driver_payout > 0) {
        runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [existing.driver_payout, existing.driver_id]);
      }
      if (existing.supplier_id && existing.supplier_cost > 0) {
        runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [existing.supplier_cost, existing.supplier_id]);
      }
      const effVehId = vehicle_id !== undefined ? vehicle_id : existing.vehicle_id;
      if (effVehId && (newStatus === 'Cancelled' || newStatus === 'No Show')) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    }
    // If cancelled or no show, free vehicle
    else if (newStatus === 'Cancelled' || newStatus === 'No Show') {
      const effVehId = vehicle_id !== undefined ? vehicle_id : existing.vehicle_id;
      if (effVehId) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    }
  }

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'booking',
    id,
    `Updated booking ${existing.booking_ref}`
  );

  const updated = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  return res.json({
    success: true,
    message: `Booking ${existing.booking_ref} updated successfully.`,
    booking: updated,
  });
});

// POST /api/bookings/:id/duplicate
router.post('/:id/duplicate', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Original booking not found.' });
  }

  const newId = 'bk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newRef = generateBookingRef();
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO bookings (
      id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
      passengers_count, luggage_count, pickup_location, dropoff_location, flight_number, airline,
      vehicle_type, vehicle_id, driver_id, supplier_id, customer_name, customer_phone,
      customer_price, supplier_cost, driver_payout, currency, payment_status, paid_amount,
      trip_status, special_instructions, dispatcher_notes,
      created_by_id, created_by_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      'Awaiting Assignment', ?, ?,
      ?, ?, ?, ?
    )`,
    [
      newId,
      newRef,
      now.split('T')[0],
      existing.pickup_date,
      existing.pickup_time,
      existing.passenger_name + ' (Duplicate)',
      existing.contact_number,
      existing.passengers_count,
      existing.luggage_count,
      existing.pickup_location,
      existing.dropoff_location,
      existing.flight_number,
      existing.airline,
      existing.vehicle_type,
      null, // Reset vehicle for dispatch
      null, // Reset driver
      existing.supplier_id,
      existing.customer_name,
      existing.customer_phone,
      existing.customer_price,
      existing.supplier_cost,
      existing.driver_payout,
      existing.currency,
      'unpaid',
      0,
      existing.special_instructions,
      `Duplicated from ${existing.booking_ref}`,
      req.user?.id,
      req.user?.full_name,
      now,
      now,
    ]
  );

  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_' + Date.now(),
      newId,
      newRef,
      'New Booking',
      'Awaiting Assignment',
      req.user?.full_name,
      `Duplicated from ${existing.booking_ref}`,
      now,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CREATE',
    'booking',
    newId,
    `Duplicated booking ${existing.booking_ref} to new booking ${newRef}`
  );

  const newBooking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [newId]);
  return res.status(201).json({
    success: true,
    message: `Booking successfully duplicated with new reference ${newRef}.`,
    booking: newBooking,
  });
});

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', requireAuth, requirePermission('bookings'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const now = new Date().toISOString();
  runSql(
    `UPDATE bookings SET trip_status = 'Cancelled', cancellation_reason = ?, updated_by_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
    [reason || 'Cancelled by dispatcher', req.user?.id, req.user?.full_name, now, id]
  );

  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_' + Date.now(),
      id,
      existing.booking_ref,
      existing.trip_status,
      'Cancelled',
      req.user?.id,
      req.user?.full_name,
      reason || 'Cancelled',
      now,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CANCEL',
    'booking',
    id,
    `Cancelled booking ${existing.booking_ref}. Reason: ${reason || 'Not specified'}`
  );

  return res.json({
    success: true,
    message: `Booking ${existing.booking_ref} has been marked as Cancelled.`,
  });
});

// DELETE /api/bookings/:id (restricted to super_admin or admin)
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can delete booking records.' });
  }

  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  runSql(`DELETE FROM bookings WHERE id = ?`, [id]);
  runSql(`DELETE FROM trip_status_logs WHERE booking_id = ?`, [id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'DELETE',
    'booking',
    id,
    `Deleted booking ${existing.booking_ref} (${existing.passenger_name})`
  );

  return res.json({ success: true, message: `Booking ${existing.booking_ref} deleted.` });
});

export default router;
