import { Router, Response } from 'express';
import { queryAll, queryOne } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/sync/pulse
router.get('/pulse', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const lastLog = queryOne(`SELECT id, timestamp, action, entity, entity_id FROM audit_logs ORDER BY timestamp DESC LIMIT 1`);
  const activeCount = queryOne(`SELECT count(*) as count FROM bookings WHERE trip_status NOT IN ('Trip Completed', 'Cancelled')`)?.count || 0;
  const unassignedCount = queryOne(`SELECT count(*) as count FROM bookings WHERE (driver_id IS NULL OR driver_id = '') AND trip_status NOT IN ('Cancelled', 'Trip Completed')`)?.count || 0;
  const completedToday = queryOne(
    `SELECT count(*) as count FROM bookings WHERE trip_status = 'Trip Completed' AND pickup_date = ?`,
    [new Date().toISOString().split('T')[0]]
  )?.count || 0;

  return res.json({
    serverTime: new Date().toISOString(),
    lastAuditId: lastLog?.id || 'none',
    lastChangeTime: lastLog?.timestamp || new Date().toISOString(),
    activeCount,
    unassignedCount,
    completedToday,
    user: req.user?.username,
  });
});

export default router;
