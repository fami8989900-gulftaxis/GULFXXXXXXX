import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, runSql } from '../db.js';
import { requireAuth, requireRole, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/users
router.get('/', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const users = queryAll(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, last_login, created_at, updated_at 
     FROM users 
     ORDER BY created_at ASC`
  );

  const formatted = users.map((u) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(u.permissions || '[]');
    } catch (e) {
      perms = [];
    }
    return {
      ...u,
      permissions: perms,
    };
  });

  return res.json({ users: formatted });
});

// POST /api/users
router.post('/', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, full_name, role, phone, permissions } = req.body;

  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Please enter username, email, password, full name, and role.' });
  }

  // Check unique username or email
  const existing = queryOne(
    `SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
    [username.trim(), email.trim()]
  );
  if (existing) {
    return res.status(409).json({ error: 'A user with this username or email address already exists.' });
  }

  const id = 'usr_' + Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  const permsArray = Array.isArray(permissions) ? permissions : ['dashboard', 'bookings'];

  runSql(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, phone, permissions, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      username.trim().toLowerCase(),
      email.trim().toLowerCase(),
      passwordHash,
      full_name.trim(),
      role,
      phone?.trim() || null,
      JSON.stringify(permsArray),
      now,
      now,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'CREATE',
    'user',
    id,
    `Created user account: ${username} (${role})`
  );

  const created = queryOne(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, created_at FROM users WHERE id = ?`,
    [id]
  );

  return res.status(201).json({
    success: true,
    user: {
      ...created,
      permissions: permsArray,
    },
    message: `User ${full_name} successfully created.`,
  });
});

// PUT /api/users/:id
router.put('/:id', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Only super_admin can modify another super_admin
  if (existing.role === 'super_admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a Super Administrator can modify Super Admin accounts.' });
  }

  const { full_name, role, phone, permissions, is_active, password } = req.body;
  const now = new Date().toISOString();

  let passwordHash = existing.password_hash;
  if (password && password.trim().length >= 6) {
    passwordHash = bcrypt.hashSync(password.trim(), 10);
  }

  const perms = permissions ? JSON.stringify(permissions) : existing.permissions;

  runSql(
    `UPDATE users SET
      full_name = ?,
      role = ?,
      phone = ?,
      permissions = ?,
      is_active = ?,
      password_hash = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      full_name ? full_name.trim() : existing.full_name,
      role || existing.role,
      phone !== undefined ? phone : existing.phone,
      perms,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      passwordHash,
      now,
      id,
    ]
  );

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'user',
    id,
    `Updated profile/permissions for ${existing.username}`
  );

  const updated = queryOne(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, updated_at FROM users WHERE id = ?`,
    [id]
  );

  return res.json({
    success: true,
    user: {
      ...updated,
      permissions: JSON.parse(updated.permissions || '[]'),
    },
    message: `User ${updated.full_name} updated successfully.`,
  });
});

// POST /api/users/:id/toggle-status
router.post('/:id/toggle-status', requireAuth, requireRole('super_admin', 'admin'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const target = queryOne(`SELECT id, username, role, is_active FROM users WHERE id = ?`, [id]);
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (target.id === req.user?.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own active account.' });
  }

  const newStatus = target.is_active === 1 ? 0 : 1;
  const now = new Date().toISOString();

  runSql(`UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?`, [newStatus, now, id]);

  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    'UPDATE',
    'user',
    id,
    `${newStatus === 1 ? 'Activated' : 'Deactivated'} user account ${target.username}`
  );

  return res.json({
    success: true,
    is_active: newStatus,
    message: `User ${target.username} has been ${newStatus === 1 ? 'activated' : 'deactivated'}.`,
  });
});

export default router;
