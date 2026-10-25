import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/dispatch
router.get('/', requireAuth, requirePermission('dispatch'), (req: AuthenticatedRequest, res: Response) => {
  const { date, status, unassignedOnly } = req.query;

  let sql = `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      d.driver_code,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      v.vehicle_type as vehicle_category,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (date) {
    sql += ` AND b.pickup_date = ?`;
    params.push(date);
  }

  if (unassignedOnly === 'true') {
    sql += ` AND (b.driver_id IS NULL OR b.driver_id = '') AND b.trip_status NOT IN ('Cancelled', 'Trip Completed')`;
  } else if (status && status !== 'all') {
    sql += ` AND b.trip_status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY b.pickup_date ASC, b.pickup_time ASC`;

  const trips = queryAll(sql, params);

  // Also fetch list of available drivers & vehicles for quick assignment dropdowns
  const availableDrivers = queryAll(
    `SELECT id, driver_code, full_name, mobile, assigned_vehicle_id, is_active FROM drivers WHERE is_active = 1 ORDER BY full_name ASC`
  );
  const availableVehicles = queryAll(
    `SELECT id, reg_number, vehicle_type, make_model, passenger_capacity, status FROM vehicles WHERE status != 'inactive' ORDER BY make_model ASC`
  );
  const suppliers = queryAll(
    `SELECT id, supplier_code, name, mobile FROM suppliers WHERE is_active = 1 ORDER BY name ASC`
  );

  return res.json({
    trips,
    availableDrivers,
    availableVehicles,
    suppliers,
  });
});

// POST /api/dispatch/check-conflicts
router.post('/check-conflicts', requireAuth, requirePermission('dispatch'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, driverId, vehicleId, pickupDate, pickupTime } = req.body;

  const conflicts: Array<{ type: 'driver' | 'vehicle'; bookingRef: string; passengerName: string; time: string }> = [];

  if (!pickupDate || !pickupTime) {
    return res.json({ conflicts: [] });
  }

  // Look for overlapping trips within +/- 2 hours on same pickup date
  const [targetH, targetM] = pickupTime.split(':').map((n: string) => parseInt(n, 10));
  const targetMinutes = (targetH || 0) * 60 + (targetM || 0);

  const existingTrips = queryAll(
    `SELECT id, booking_ref, passenger_name, pickup_date, pickup_time, driver_id, vehicle_id 
     FROM bookings 
     WHERE pickup_date = ? 
       AND id != ? 
       AND trip_status NOT IN ('Cancelled', 'Trip Completed', 'No Show')`,
    [pickupDate, bookingId || '']
  );

  for (const t of existingTrips) {
    const [h, m] = (t.pickup_time || '00:00').split(':').map((n: string) => parseInt(n, 10));
    const tripMinutes = (h || 0) * 60 + (m || 0);
    const diffHours = Math.abs(tripMinutes - targetMinutes) / 60;

    if (diffHours < 2.0) {
      if (driverId && t.driver_id === driverId) {
        conflicts.push({
          type: 'driver',
          bookingRef: t.booking_ref,
          passengerName: t.passenger_name,
          time: t.pickup_time,
        });
      }
      if (vehicleId && t.vehicle_id === vehicleId) {
        conflicts.push({
          type: 'vehicle',
          bookingRef: t.booking_ref,
          passengerName: t.passenger_name,
          time: t.pickup_time,
        });
      }
    }
  }

  return res.json({
    hasConflict: conflicts.length > 0,
    conflicts,
  });
});

// POST /api/dispatch/assign
router.post('/assign', requireAuth, requirePermission('dispatch'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, driverId, vehicleId, supplierId, forceOverride, dispatcherNotes } = req.body;

  const booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  // Fetch driver & vehicle details
  const driver = driverId ? queryOne(`SELECT * FROM drivers WHERE id = ?`, [driverId]) : null;
  const vehicle = vehicleId ? queryOne(`SELECT * FROM vehicles WHERE id = ?`, [vehicleId]) : null;

  const now = new Date().toISOString();
  let newStatus = booking.trip_status;
  if (driverId && (booking.trip_status === 'New Booking' || booking.trip_status === 'Awaiting Assignment')) {
    newStatus = 'Assigned';
  }

  runSql(
    `UPDATE bookings SET
      driver_id = ?,
      vehicle_id = ?,
      supplier_id = ?,
      trip_status = ?,
      dispatcher_notes = COALESCE(?, dispatcher_notes),
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      driverId || null,
      vehicleId || null,
      supplierId !== undefined ? supplierId : booking.supplier_id,
      newStatus,
      dispatcherNotes || null,
      req.user?.id,
      req.user?.full_name,
      now,
      bookingId,
    ]
  );

  // Log status change
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_' + Date.now(),
      booking.id,
      booking.booking_ref,
      booking.trip_status,
      newStatus,
      req.user?.id,
      req.user?.full_name,
      `Assigned Driver: ${driver ? driver.full_name : 'None'}, Vehicle: ${vehicle ? vehicle.reg_number : 'None'}`,
      now,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'ASSIGN',
    'booking',
    bookingId,
    `Assigned ${driver ? driver.full_name : 'No driver'} to booking ${booking.booking_ref}`
  );

  const updatedBooking = queryOne(
    `SELECT b.*, d.full_name as driver_name, d.mobile as driver_phone, v.reg_number as vehicle_reg, v.make_model as vehicle_model
     FROM bookings b
     LEFT JOIN drivers d ON b.driver_id = d.id
     LEFT JOIN vehicles v ON b.vehicle_id = v.id
     WHERE b.id = ?`,
    [bookingId]
  );

  return res.json({
    success: true,
    message: `Dispatch assignment saved for ${booking.booking_ref}.`,
    booking: updatedBooking,
  });
});

// POST /api/dispatch/update-status
router.post('/update-status', requireAuth, requirePermission('dispatch'), (req: AuthenticatedRequest, res: Response) => {
  const { bookingId, status, notes } = req.body;

  const validStatuses = [
    'New Booking',
    'Awaiting Assignment',
    'Assigned',
    'Driver Notified',
    'Driver on the Way',
    'Arrived at Pickup',
    'Passenger Picked Up',
    'Trip Completed',
    'Cancelled',
    'No Show',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid trip status.' });
  }

  const booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  const now = new Date().toISOString();

  runSql(
    `UPDATE bookings SET
      trip_status = ?,
      dispatcher_notes = CASE WHEN ? IS NOT NULL THEN ? ELSE dispatcher_notes END,
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [status, notes || null, notes || null, req.user?.id, req.user?.full_name, now, bookingId]
  );

  // If completed or cancelled, make vehicle available again
  if ((status === 'Trip Completed' || status === 'Cancelled' || status === 'No Show') && booking.vehicle_id) {
    runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [booking.vehicle_id]);
  } else if (booking.vehicle_id && (status === 'Driver on the Way' || status === 'Passenger Picked Up')) {
    runSql(`UPDATE vehicles SET status = 'on_trip' WHERE id = ?`, [booking.vehicle_id]);
  }

  // If completed, update driver/supplier payable balance if applicable
  if (status === 'Trip Completed' && booking.trip_status !== 'Trip Completed') {
    if (booking.driver_id && booking.driver_payout > 0) {
      runSql(`UPDATE drivers SET current_balance = current_balance + ? WHERE id = ?`, [booking.driver_payout, booking.driver_id]);
    }
    if (booking.supplier_id && booking.supplier_cost > 0) {
      runSql(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`, [booking.supplier_cost, booking.supplier_id]);
    }
  }

  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_' + Date.now(),
      booking.id,
      booking.booking_ref,
      booking.trip_status,
      status,
      req.user?.id,
      req.user?.full_name,
      notes || `Status changed from ${booking.trip_status} to ${status}`,
      now,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'dispatch',
    bookingId,
    `Trip ${booking.booking_ref} status changed to ${status}`
  );

  return res.json({
    success: true,
    message: `Trip ${booking.booking_ref} status updated to '${status}'.`,
    newStatus: status,
  });
});

export default router;
