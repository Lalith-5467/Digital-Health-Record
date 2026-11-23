import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ProfileService } from '../services/profile.service';
import {
  patientUpdateSchema,
  doctorUpdateSchema,
  nurseUpdateSchema,
  pharmacistUpdateSchema,
  caregiverUpdateSchema,
  insuranceUpdateSchema,
} from '../utils/validators';

function getTargetUserId(req: Request): string {
  const user = req.user!;
  // Admins & Super Admins can query or edit on behalf of another user if ?userId is provided
  if (
    (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) &&
    typeof req.query.userId === 'string'
  ) {
    return req.query.userId;
  }
  return user.id;
}

export const getCurrentUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await ProfileService.getCurrentUserProfile(req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PATIENT HANDLERS
// ==========================================
export const getPatientProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getPatientProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updatePatientProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = patientUpdateSchema.parse(req.body);
    const data = await ProfileService.updatePatientProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Patient profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DOCTOR HANDLERS
// ==========================================
export const getDoctorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getDoctorProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateDoctorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = doctorUpdateSchema.parse(req.body);
    const data = await ProfileService.updateDoctorProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Doctor profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// NURSE HANDLERS
// ==========================================
export const getNurseProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getNurseProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateNurseProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = nurseUpdateSchema.parse(req.body);
    const data = await ProfileService.updateNurseProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Nurse profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PHARMACIST HANDLERS
// ==========================================
export const getPharmacistProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getPharmacistProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updatePharmacistProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = pharmacistUpdateSchema.parse(req.body);
    const data = await ProfileService.updatePharmacistProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Pharmacist profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CAREGIVER HANDLERS
// ==========================================
export const getCaregiverProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getCaregiverProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateCaregiverProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = caregiverUpdateSchema.parse(req.body);
    const data = await ProfileService.updateCaregiverProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Caregiver profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// INSURANCE HANDLERS
// ==========================================
export const getInsuranceProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.getInsuranceProfile(targetUserId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateInsuranceProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const validated = insuranceUpdateSchema.parse(req.body);
    const data = await ProfileService.updateInsuranceProfile(
      targetUserId,
      validated,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Insurance profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// USER PREFERENCES (ALL ROLES) & ADMIN PROFILE
// ==========================================
export const getUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await ProfileService.getUserPreferences(req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await ProfileService.updateUserPreferences(req.user!.id, req.body, req.ip);
    res.status(200).json({ success: true, message: 'Preferences saved successfully', data });
  } catch (error) {
    next(error);
  }
};

export const updateAdminAccountProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = getTargetUserId(req);
    const data = await ProfileService.updateAdminAccountProfile(
      targetUserId,
      req.body,
      req.user!.id,
      req.ip
    );
    res.status(200).json({ success: true, message: 'Account profile updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const patchCurrentUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const role = req.user!.role;
    if (role === Role.PATIENT) return updatePatientProfile(req, res, next);
    if (role === Role.DOCTOR) return updateDoctorProfile(req, res, next);
    if (role === Role.NURSE) return updateNurseProfile(req, res, next);
    if (role === Role.PHARMACIST) return updatePharmacistProfile(req, res, next);
    if (role === Role.CAREGIVER) return updateCaregiverProfile(req, res, next);
    if (role === Role.INSURANCE_PROVIDER) return updateInsuranceProfile(req, res, next);
    return updateAdminAccountProfile(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const updateDoctorAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { prisma } = await import('../config/prisma');
    const targetUserId = getTargetUserId(req);
    const doctor = await prisma.doctor.findUnique({ where: { userId: targetUserId } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const workingDays: string[] = Array.isArray(req.body.workingDays) ? req.body.workingDays : [];
    const startTime = String(req.body.opdStartTime || req.body.startTime || '09:00');
    const endTime = String(req.body.opdEndTime || req.body.endTime || '17:00');
    const [lunchStart, lunchEnd] = String(req.body.lunchTime || '13:00 - 14:00').split('-').map((s: string) => s.trim());
    const slotDurationMin = parseInt(String(req.body.consultDuration || req.body.slotDurationMin || 20), 10) || 20;

    await prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({ where: { doctorId: doctor.id } });
      for (const dayName of workingDays) {
        const dayNum = typeof dayName === 'number' ? dayName : dayMap[dayName];
        if (dayNum === undefined) continue;
        await tx.doctorAvailability.create({
          data: {
            doctorId: doctor.id,
            dayOfWeek: dayNum,
            startTime,
            endTime,
            lunchStart: lunchStart || null,
            lunchEnd: lunchEnd || null,
            slotDurationMin,
            isTelemedicine: false,
            isActive: true,
          },
        });
      }
    });

    const saved = await prisma.doctorAvailability.findMany({ where: { doctorId: doctor.id } });
    res.status(200).json({ success: true, message: 'Doctor availability saved to database', data: saved });
  } catch (error) {
    next(error);
  }
};
