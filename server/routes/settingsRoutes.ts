import { Router, Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requireRole, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/settings
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rows = queryAll(`SELECT key, value FROM settings`);
  const settings: Record<string, any> = {};

  for (const r of rows) {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch (e) {
      settings[r.key] = r.value;
    }
  }

  return res.json({ settings });
});

// PUT /api/settings
router.put('/', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Settings key and value are required.' });
  }

  const jsonVal = typeof value === 'object' ? JSON.stringify(value) : value;
  const existing = queryOne(`SELECT key FROM settings WHERE key = ?`, [key]);

  if (existing) {
    runSql(`UPDATE settings SET value = ? WHERE key = ?`, [jsonVal, key]);
  } else {
    runSql(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, jsonVal]);
  }

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'setting',
    key,
    `Updated system setting '${key}'`
  );

  return res.json({ success: true, message: `Setting '${key}' updated successfully.` });
});

// GET /api/settings/audit-logs
router.get('/audit-logs', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { entity, action, limit } = req.query;

  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params: any[] = [];

  if (entity && entity !== 'all') {
    sql += ` AND entity = ?`;
    params.push(entity);
  }

  if (action && action !== 'all') {
    sql += ` AND action = ?`;
    params.push(action);
  }

  sql += ` ORDER BY timestamp DESC`;

  const parsedLimit = limit ? parseInt(limit as string, 10) : 200;
  sql += ` LIMIT ${parsedLimit}`;

  const logs = queryAll(sql, params);
  return res.json({ logs });
});

export default router;
