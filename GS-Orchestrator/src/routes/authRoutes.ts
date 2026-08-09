import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService';
import { AuthUser, LoginRequest, LoginResponse } from '../domain/User';

const JWT_SECRET = process.env.JWT_SECRET || 'gs-orchestrator-jwt-secret-change-in-production';
const JWT_EXPIRY = '24h';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function createAuthRoutes(userService: UserService) {
  const router = Router();

  // Get client IP address (handles proxies)
  const getClientIp = (req: Request): string => {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      ''
    );
  };

  const isLocalhost = (ip: string): boolean => {
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('::ffff:127.0.0.1');
  };

  /**
   * POST /auth/login
   * Login endpoint supporting both regular users and Thor superadmin
   */
  router.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body as LoginRequest;
    const clientIp = getClientIp(req);
    const isLocal = isLocalhost(clientIp);

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      } as LoginResponse);
    }

    const user = userService.authenticate(username, password, isLocal);

    if (user) {
      // Generate JWT token
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRY });

      return res.status(200).json({
        success: true,
        user,
        token
      });
    }

    if (username === 'thor' && !isLocal) {
      return res.status(403).json({
        success: false,
        message: 'Thor superadmin login is only available from localhost'
      } as LoginResponse);
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    } as LoginResponse);
  });

  /**
   * POST /auth/verify
   * Verify JWT token
   */
  router.post('/verify', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      res.status(200).json({
        success: true,
        user: decoded
      });
    } catch (err) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  });

  /**
   * GET /auth/current-user
   * Get current logged-in user (requires valid token)
   */
  router.get('/current-user', verifyJWT, (req: AuthRequest, res: Response) => {
    if (req.user) {
      return res.status(200).json({
        success: true,
        user: req.user
      });
    }

    res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  });

  /**
   * GET /auth/check
   * Check if token in header is valid
   */
  router.get('/check', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(200).json({
        authenticated: false,
        user: null
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      res.status(200).json({
        authenticated: true,
        user: decoded
      });
    } catch (err) {
      res.status(200).json({
        authenticated: false,
        user: null
      });
    }
  });

  return router;
}

/**
 * Middleware to verify JWT token
 */
export function verifyJWT(req: AuthRequest, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: AuthRequest, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    if (decoded.role === 'ADMIN' || decoded.role === 'SUPERADMIN') {
      req.user = decoded;
      return next();
    }
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to require superadmin role
 */
export function requireSuperAdmin(req: AuthRequest, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    if (decoded.role === 'SUPERADMIN') {
      req.user = decoded;
      return next();
    }
    res.status(403).json({
      success: false,
      message: 'Superadmin access required'
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}
