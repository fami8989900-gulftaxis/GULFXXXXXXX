import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, runSql } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gulf_taxis_dispatch_secure_key_2026_riyadh_cloud';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded as AuthUser;
  } catch (err) {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.gt_token) {
    token = req.cookies.gt_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  // Verify user still exists in database and is active
  const dbUser = queryOne('SELECT id, is_active FROM users WHERE id = ?', [user.id]);
  if (!dbUser || dbUser.is_active !== 1) {
    return res.status(403).json({ error: 'User account has been deactivated or removed.' });
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role === 'super_admin') {
      return next(); // Super admin bypasses role restrictions
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Your role (${req.user.role}) is not authorized for this operation.`,
      });
    }

    next();
  };
}

export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    const permissions = req.user.permissions || [];
    if (permissions.includes('all') || permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({
      error: `Access restricted. You do not have permission to access the '${permissionKey}' module.`,
    });
  };
}

export function recordAuditLog(
  userId: string | undefined,
  userName: string | undefined,
  action: string,
  entity: string,
  entityId: string | null,
  details: string,
  ipAddress?: string
) {
  try {
    const id = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    runSql(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, details, ip_address, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId || 'system', userName || 'System Action', action, entity, entityId, details, ipAddress || '', now]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
