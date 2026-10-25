import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requirePermission, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/vehicles
router.get('/', requireAuth, requirePermission('vehicles'), (req: AuthenticatedRequest, res: Response) => {
  const { search, type, status } = req.query;

  let sql = `
    SELECT 
      v.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      s.name as supplier_name,
      (SELECT COUNT(*) FROM bookings WHERE vehicle_id = v.id) as total_trips_count
    FROM vehicles v
    LEFT JOIN drivers d ON v.assigned_driver_id = d.id
    LEFT JOIN suppliers s ON v.supplier_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search && typeof search === 'string') {
    sql += ` AND (v.reg_number LIKE ? OR v.make_model LIKE ? OR v.vehicle_type LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (type && type !== 'all') {
    sql += ` AND v.vehicle_type = ?`;
    params.push(type);
  }

  if (status && status !== 'all') {
    sql += ` AND v.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY v.vehicle_type ASC, v.make_model ASC`;

  const vehicles = queryAll(sql, params);
  return res.json({ vehicles });
});

// POST /api/vehicles
router.post('/', requireAuth, requirePermission('vehicles'), (req: AuthenticatedRequest, res: Response) => {
  const {
    reg_number,
    vehicle_type,
    make_model,
    passenger_capacity,
    luggage_capacity,
    supplier_id,
    assigned_driver_id,
    status,
    color,
    model_year,
    notes,
  } = req.body;

  if (!reg_number || !vehicle_type || !make_model) {
    return res.status(400).json({ error: 'Please enter Registration Number, Vehicle Type, and Make/Model.' });
  }

  // Check unique registration number
  const existing = queryOne(`SELECT id FROM vehicles WHERE LOWER(reg_number) = LOWER(?)`, [reg_number.trim()]);
  if (existing) {
    return res.status(409).json({ error: `A vehicle with registration number '${reg_number}' already exists.` });
  }

  const id = 'veh_' + Date.now();
  const now = new Date().toISOString();

  runSql(
    `INSERT INTO vehicles (
      id, reg_number, vehicle_type, make_model, passenger_capacity, luggage_capacity,
      supplier_id, assigned_driver_id, status, color, model_year, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reg_number.trim().toUpperCase(),
      vehicle_type,
      make_model.trim(),
      parseInt(passenger_capacity, 10) || 4,
      parseInt(luggage_capacity, 10) || 3,
      supplier_id || null,
      assigned_driver_id || null,
      status || 'available',
      color || null,
      parseInt(model_year, 10) || new Date().getFullYear(),
      notes || null,
      now,
      now,
    ]
  );

  // If driver assigned, update driver's assigned_vehicle_id
  if (assigned_driver_id) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?`, [id, assigned_driver_id]);
  }

  recordAuditLog(req.user?.id, req.user?.full_name, 'CREATE', 'vehicle', id, `Added vehicle ${reg_number} (${make_model})`);

  const created = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, vehicle: created, message: `Vehicle ${reg_number} created successfully.` });
});

// PUT /api/vehicles/:id
router.put('/:id', requireAuth, requirePermission('vehicles'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }

  const {
    reg_number,
    vehicle_type,
    make_model,
    passenger_capacity,
    luggage_capacity,
    supplier_id,
    assigned_driver_id,
    status,
    color,
    model_year,
    notes,
  } = req.body;

  const now = new Date().toISOString();

  runSql(
    `UPDATE vehicles SET
      reg_number = ?,
      vehicle_type = ?,
      make_model = ?,
      passenger_capacity = ?,
      luggage_capacity = ?,
      supplier_id = ?,
      assigned_driver_id = ?,
      status = ?,
      color = ?,
      model_year = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      reg_number ? reg_number.trim().toUpperCase() : existing.reg_number,
      vehicle_type || existing.vehicle_type,
      make_model ? make_model.trim() : existing.make_model,
      passenger_capacity !== undefined ? parseInt(passenger_capacity, 10) : existing.passenger_capacity,
      luggage_capacity !== undefined ? parseInt(luggage_capacity, 10) : existing.luggage_capacity,
      supplier_id !== undefined ? supplier_id : existing.supplier_id,
      assigned_driver_id !== undefined ? assigned_driver_id : existing.assigned_driver_id,
      status || existing.status,
      color !== undefined ? color : existing.color,
      model_year !== undefined ? parseInt(model_year, 10) : existing.model_year,
      notes !== undefined ? notes : existing.notes,
      now,
      id,
    ]
  );

  // Synchronize two-way link to driver
  const targetDriverId = assigned_driver_id !== undefined ? assigned_driver_id : existing.assigned_driver_id;
  if (existing.assigned_driver_id && existing.assigned_driver_id !== targetDriverId) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE id = ? AND assigned_vehicle_id = ?`, [existing.assigned_driver_id, id]);
  }
  if (targetDriverId) {
    runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ? AND id != ?`, [targetDriverId, id]);
    runSql(`UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?`, [id, targetDriverId]);
  }

  recordAuditLog(req.user?.id, req.user?.full_name, 'UPDATE', 'vehicle', id, `Updated vehicle ${existing.reg_number}`);

  const updated = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  return res.json({ success: true, vehicle: updated, message: `Vehicle ${updated.reg_number} updated successfully.` });
});

// DELETE /api/vehicles/:id
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can delete fleet vehicles.' });
  }

  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Vehicle not found.' });
  }

  runSql(`DELETE FROM vehicles WHERE id = ?`, [id]);
  recordAuditLog(req.user?.id, req.user?.full_name, 'DELETE', 'vehicle', id, `Deleted vehicle ${existing.reg_number}`);

  return res.json({ success: true, message: `Vehicle ${existing.reg_number} deleted.` });
});

export default router;
