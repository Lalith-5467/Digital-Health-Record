import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env';
import { prisma } from '../config/prisma';

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  jti?: string;
  hospitalId?: string;
  hospitalCode?: string;
  hospitalName?: string;
  isHospitalAdmin?: boolean;
}

/**
 * Verifies a Bearer JWT token against signing secret, active non-revoked UserSession, and active User record.
 */
export async function verifySessionToken(token: string) {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

  if (!decoded || !decoded.id) {
    const err = new Error('Invalid authentication token.');
    (err as any).statusCode = 401;
    throw err;
  }

  // Enforce session revocation when jti is present (or require session record)
  if (!decoded.jti) {
    const err = new Error('Session token is missing session identifier. Please login again.');
    (err as any).statusCode = 401;
    throw err;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenJti: decoded.jti },
    select: {
      id: true,
      userId: true,
      isRevoked: true,
      expiresAt: true,
    },
  });

  if (!session || session.userId !== decoded.id || session.isRevoked || session.expiresAt <= new Date()) {
    const err = new Error('Session has been revoked or expired. Please login again.');
    (err as any).statusCode = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      role: true,
      abhaId: true,
      phoneNumber: true,
      isActive: true,
      isOriginalSuperAdmin: true,
      isViewOnly: true,
      managedHospitals: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    const err = new Error('User no longer exists or account is inactive.');
    (err as any).statusCode = 401;
    throw err;
  }

  // A Super Admin is View-Only if isViewOnly is true, or if they are a secondary Super Admin (not original)
  const isOriginal = Boolean(user.isOriginalSuperAdmin);
  const isViewOnly = Boolean(user.isViewOnly || (user.role === Role.SUPER_ADMIN && !isOriginal));

  const managedHospital = user.managedHospitals && user.managedHospitals.length > 0 ? user.managedHospitals[0] : null;
  const isHospitalAdmin = Boolean(
    (user.role === Role.ADMIN && (managedHospital || decoded.isHospitalAdmin))
  );

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    abhaId: user.abhaId,
    phoneNumber: user.phoneNumber,
    jti: decoded.jti,
    isOriginalSuperAdmin: isOriginal,
    isViewOnly,
    managedHospitalId: managedHospital ? managedHospital.id : (decoded.hospitalId || undefined),
    managedHospitalName: managedHospital ? managedHospital.name : (decoded.hospitalName || undefined),
    managedHospitalCode: managedHospital ? managedHospital.code : (decoded.hospitalCode || undefined),
    isHospitalAdmin,
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid. Please provide Bearer token.',
      });
      return;
    }

    const token = authHeader.split(' ')[1]?.trim();

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token is required.',
      });
      return;
    }

    try {
      const authUser = await verifySessionToken(token);
      req.user = authUser;
      next();
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'Authentication token has expired. Please login again.',
        });
        return;
      }
      if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
        res.status(401).json({
          success: false,
          message: 'Invalid authentication token.',
        });
        return;
      }
      if (err?.statusCode === 401) {
        res.status(401).json({
          success: false,
          message: err.message,
        });
        return;
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticates access to uploaded PHI files via Authorization header or ?token= query parameter.
 */
export const authenticateUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]?.trim()
      : queryToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required to access uploaded files.',
      });
      return;
    }

    try {
      req.user = await verifySessionToken(token);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    } catch (err: any) {
      res.status(401).json({
        success: false,
        message: err?.message || 'Invalid or expired authentication token.',
      });
    }
  } catch (error) {
    next(error);
  }
};
