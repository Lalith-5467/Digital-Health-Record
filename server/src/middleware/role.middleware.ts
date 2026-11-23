import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

export type AllowedRole = Role | 'INSURANCE' | 'SUPER_ADMIN' | string;

export const DEFAULT_RBAC_MATRIX: Record<string, Record<string, boolean>> = {
  'View Patient Records': { Patient: true, Doctor: true, Nurse: true, Pharmacist: false, Caregiver: true, Insurance: false, Admin: true, 'Super Admin': true },
  'Edit Medical Records': { Patient: false, Doctor: true, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
  'Create Prescription': { Patient: false, Doctor: true, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
  'Dispense Medicines': { Patient: false, Doctor: false, Nurse: false, Pharmacist: true, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
  'Record Patient Vitals': { Patient: true, Doctor: true, Nurse: true, Pharmacist: false, Caregiver: true, Insurance: false, Admin: false, 'Super Admin': true },
  'Approve Insurance Claims': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: true, Admin: false, 'Super Admin': true },
  'Manage User Accounts': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: true, 'Super Admin': true },
  'Manage Administrator Roles': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
  'Configure Security & Firewalls': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
  'View Audit & Activity Logs': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: true, 'Super Admin': true },
  'Trigger System Backup': { Patient: false, Doctor: false, Nurse: false, Pharmacist: false, Caregiver: false, Insurance: false, Admin: false, 'Super Admin': true },
};

let cachedRbacMatrix: Record<string, Record<string, boolean>> | null = null;
let lastRbacCacheTime = 0;
const RBAC_CACHE_TTL_MS = 10000; // 10 seconds in-memory cache

export function invalidateRbacCache(): void {
  cachedRbacMatrix = null;
  lastRbacCacheTime = 0;
}

export async function getActiveRbacMatrix(): Promise<Record<string, Record<string, boolean>>> {
  const now = Date.now();
  if (cachedRbacMatrix && now - lastRbacCacheTime < RBAC_CACHE_TTL_MS) {
    return cachedRbacMatrix;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { id: 'default' },
      select: { rbacMatrix: true },
    });

    if (setting && setting.rbacMatrix) {
      const parsed = typeof setting.rbacMatrix === 'string'
        ? JSON.parse(setting.rbacMatrix)
        : setting.rbacMatrix;
      if (parsed && typeof parsed === 'object') {
        cachedRbacMatrix = parsed;
        lastRbacCacheTime = now;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[RBAC Middleware] Failed to load matrix from database, using defaults:', err);
  }

  cachedRbacMatrix = DEFAULT_RBAC_MATRIX;
  lastRbacCacheTime = now;
  return DEFAULT_RBAC_MATRIX;
}

export function mapRoleToMatrixKey(role: Role): string {
  switch (role) {
    case Role.PATIENT: return 'Patient';
    case Role.DOCTOR: return 'Doctor';
    case Role.NURSE: return 'Nurse';
    case Role.PHARMACIST: return 'Pharmacist';
    case Role.CAREGIVER: return 'Caregiver';
    case Role.INSURANCE_PROVIDER: return 'Insurance';
    case Role.ADMIN: return 'Admin';
    case Role.SUPER_ADMIN: return 'Super Admin';
    default: return 'Patient';
  }
}

/**
 * Normalizes role aliases to the Prisma Role enum
 */
export function normalizeRole(role: string): Role {
  if (!role) return Role.PATIENT;
  const upper = role.toUpperCase().trim();
  if (upper === 'INSURANCE' || upper === 'INSURANCE_PROVIDER') return Role.INSURANCE_PROVIDER;
  if (upper === 'USER' || upper === 'PATIENT') return Role.PATIENT;
  if (upper === 'SUPER_ADMIN' || upper === 'SUPER ADMIN') return Role.SUPER_ADMIN;
  return upper as Role;
}

/**
 * Reusable Role-Based Authorization Middleware
 */
export const requireRole = (...allowedRoles: AllowedRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required before verifying permissions.',
      });
      return;
    }

    // View-only accounts (such as secondary Super Admin) cannot execute write operations
    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (req.user.isViewOnly && isMutatingMethod) {
      res.status(403).json({
        success: false,
        message: 'Access denied: View-only Super Administrator clearance cannot execute write, delete, or modification operations.',
      });
      return;
    }

    const userRole = normalizeRole(req.user.role);
    const normalizedAllowed = allowedRoles.map((r) => normalizeRole(r));

    // Original Root SUPER_ADMIN has access to all protected endpoints
    if (userRole === Role.SUPER_ADMIN && req.user.isOriginalSuperAdmin && !req.user.isViewOnly) {
      next();
      return;
    }

    // Secondary View-Only Super Admin can access read endpoints if SUPER_ADMIN is allowed
    if (userRole === Role.SUPER_ADMIN) {
      if (normalizedAllowed.includes(Role.SUPER_ADMIN)) {
        next();
        return;
      }
    }

    // Check if user's role is in allowed roles list
    const isAuthorized = normalizedAllowed.includes(userRole);

    if (!isAuthorized) {
      res.status(403).json({
        success: false,
        message: `Access denied: insufficient permissions. Required: [${allowedRoles.join(', ')}], Current: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware requiring Original Root Super Admin clearance (excludes view-only secondary Super Admins)
 */
export const requireOriginalSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== Role.SUPER_ADMIN || !req.user.isOriginalSuperAdmin || req.user.isViewOnly) {
    res.status(403).json({
      success: false,
      message: 'Access denied: Root Original Super Admin clearance required.',
    });
    return;
  }

  next();
};

/**
 * Middleware forbidding write operations for view-only accounts
 */
export const requireWritePermission = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  if (req.user.isViewOnly) {
    res.status(403).json({
      success: false,
      message: 'Access denied: View-only Super Administrator clearance cannot execute write, delete, or modification operations.',
    });
    return;
  }

  next();
};

/**
 * Middleware dynamically enforcing the RBAC Matrix persisted in MySQL SystemSetting
 */
export const requirePermission = (permissionName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required before verifying permissions.',
      });
      return;
    }

    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (req.user.isViewOnly && isMutatingMethod) {
      res.status(403).json({
        success: false,
        message: `Access denied: View-only Super Administrator clearance cannot execute write operations for "${permissionName}".`,
      });
      return;
    }

    // Original Root Super Admin always has full access
    if (req.user.role === Role.SUPER_ADMIN && req.user.isOriginalSuperAdmin && !req.user.isViewOnly) {
      next();
      return;
    }

    try {
      const matrix = await getActiveRbacMatrix();
      const roleKey = mapRoleToMatrixKey(req.user.role);
      const permissionRow = matrix[permissionName];

      if (!permissionRow || typeof permissionRow !== 'object') {
        // Safe fallback: deny if permission configuration is missing or invalid
        res.status(403).json({
          success: false,
          message: `Access denied: Permission definition "${permissionName}" is invalid or missing in system RBAC configuration.`,
        });
        return;
      }

      const hasPermission = Boolean(permissionRow[roleKey]);

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: `Access denied: Role "${req.user.role}" does not have the "${permissionName}" permission in the active RBAC matrix.`,
        });
        return;
      }

      next();
    } catch (err: any) {
      res.status(403).json({
        success: false,
        message: `Access denied: RBAC authorization check failed: ${err?.message || err}`,
      });
    }
  };
};
