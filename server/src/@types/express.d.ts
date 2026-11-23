import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  abhaId?: string | null;
  phoneNumber?: string | null;
  jti?: string;
  isOriginalSuperAdmin?: boolean;
  isViewOnly?: boolean;
  managedHospitalId?: string;
  managedHospitalName?: string;
  managedHospitalCode?: string;
  isHospitalAdmin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
