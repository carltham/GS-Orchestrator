import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { requireSuperAdmin } from './authRoutes';

export function createAdminRoutes(userService: UserService) {
  const router = Router();

  /**
   * GET /admin/users
   * Get all users (Superadmin only)
   */
  router.get('/users', requireSuperAdmin, (req: Request, res: Response) => {
    const users = userService.getAllUsers();
    // Remove passwords from response
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      enabled: u.enabled,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt
    }));
    res.status(200).json({
      success: true,
      users: safeUsers
    });
  });

  /**
   * POST /admin/users
   * Create a new user (Superadmin only)
   */
  router.post('/users', requireSuperAdmin, (req: Request, res: Response) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const newUser = userService.createUser(username, password, role || 'USER');

    if (!newUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        enabled: newUser.enabled
      }
    });
  });

  /**
   * PUT /admin/users/:id
   * Update user (Superadmin only)
   */
  router.put('/users/:id', requireSuperAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, role, enabled } = req.body;

    const updates: any = {};
    if (email !== undefined) updates.email = email;
    if (role !== undefined && role !== 'SUPERADMIN') updates.role = role; // Cannot change to SUPERADMIN
    if (enabled !== undefined) updates.enabled = enabled;

    const updated = userService.updateUser(id, updates);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        enabled: updated.enabled
      }
    });
  });

  /**
   * DELETE /admin/users/:id
   * Delete user (Superadmin only)
   */
  router.delete('/users/:id', requireSuperAdmin, (req: Request, res: Response) => {
    const { id } = req.params;

    if (id === 'thor-superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete Thor superadmin'
      });
    }

    const deleted = userService.deleteUser(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  });

  /**
   * POST /admin/users/:id/disable
   * Disable user (Superadmin only)
   */
  router.post('/users/:id/disable', requireSuperAdmin, (req: Request, res: Response) => {
    const { id } = req.params;

    if (id === 'thor-superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot disable Thor superadmin'
      });
    }

    const disabled = userService.disableUser(id);

    if (!disabled) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User disabled successfully'
    });
  });

  /**
   * POST /admin/users/:id/enable
   * Enable user (Superadmin only)
   */
  router.post('/users/:id/enable', requireSuperAdmin, (req: Request, res: Response) => {
    const { id } = req.params;

    const enabled = userService.enableUser(id);

    if (!enabled) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User enabled successfully'
    });
  });

  /**
   * POST /admin/users/:id/change-password
   * Change user password (Superadmin only)
   */
  router.post('/users/:id/change-password', requireSuperAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    const changed = userService.changePassword(id, newPassword);

    if (!changed) {
      return res.status(404).json({
        success: false,
        message: 'User not found or cannot change password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  return router;
}
