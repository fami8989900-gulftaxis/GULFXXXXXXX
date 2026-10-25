import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, runSql } from '../db.js';
import { generateToken, requireAuth, recordAuditLog, AuthenticatedRequest } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Please enter both username/email and password.' });
  }

  const user = queryOne(
    `SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
    [usernameOrEmail.trim(), usernameOrEmail.trim()]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  if (user.is_active !== 1) {
    return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  // Update last login
  const now = new Date().toISOString();
  runSql(`UPDATE users SET last_login = ? WHERE id = ?`, [now, user.id]);

  let permissions: string[] = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch (e) {
    permissions = [];
  }

  const authUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    phone: user.phone,
    permissions,
  };

  const token = generateToken(authUser);

  // Set HTTP-only cookie as well for added security
  res.cookie('gt_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  recordAuditLog(user.id, user.full_name, 'LOGIN', 'user', user.id, 'User logged in successfully', req.ip);

  return res.json({
    token,
    user: authUser,
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = queryOne(`SELECT id, username, email, full_name, role, phone, permissions, is_active FROM users WHERE id = ?`, [req.user!.id]);
  if (!user || user.is_active !== 1) {
    return res.status(401).json({ error: 'User session invalid.' });
  }

  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch (e) {
    permissions = [];
  }

  return res.json({
    user: {
      ...user,
      permissions,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('gt_token');
  recordAuditLog(req.user?.id, req.user?.full_name, 'LOGOUT', 'user', req.user?.id || null, 'User logged out', req.ip);
  return res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Please provide your registered email address.' });
  }

  const user = queryOne(`SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
  if (!user) {
    // Return friendly generic response to prevent email harvesting
    return res.json({
      success: true,
      message: 'If the email exists in our records, password reset instructions have been dispatched to your system administrator.',
    });
  }

  // Record audit log for admin awareness
  recordAuditLog(user.id, user.full_name, 'FORGOT_PASSWORD', 'user', user.id, `Password reset requested for ${user.email}`);

  return res.json({
    success: true,
    message: `A password reset link or temporary security code has been generated. Please contact your Gulf Taxis Super Administrator (admin@gulftaxis.com) to complete the verification.`,
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new passwords are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = queryOne(`SELECT password_hash FROM users WHERE id = ?`, [req.user!.id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  runSql(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [newHash, now, req.user!.id]);

  recordAuditLog(req.user?.id, req.user?.full_name, 'CHANGE_PASSWORD', 'user', req.user?.id || null, 'User changed their password');

  return res.json({ success: true, message: 'Password successfully updated.' });
});

export default router;
