import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';

export interface PatientUpdateInput {
  fullName?: string;
  gender?: string | null;
  dateOfBirth?: string | Date | null;
  bloodGroup?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  abhaId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  familyPhone?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  organDonor?: boolean;
  preferredHospital?: string | null;
  familyDoctor?: string | null;
  criticalMedicalNotes?: string | null;
  preferredPharmacyId?: string | null;
  preferredDeliveryMethod?: string | null;
  geofenceRadiusMeters?: number | null;
  lastKnownLocation?: string | null;
}

export interface DoctorUpdateInput {
  fullName?: string;
  speciality?: string;
  department?: string | null;
  qualification?: string | null;
  licenseNumber?: string | null;
  hprAddress?: string | null;
  hospital?: string | null;
  experienceYears?: number;
  consultationFee?: number;
  onlineFee?: number | null;
  inPersonFee?: number | null;
  consultDurationMin?: number;
  teleConsultReady?: boolean;
  emergencyAvailable?: boolean;
  languagesJson?: string | null;
  notificationPrefsJson?: string | null;
  photoUrl?: string | null;
  about?: string | null;
  phoneNumber?: string | null;
}

export interface NurseUpdateInput {
  fullName?: string;
  hospital?: string | null;
  department?: string | null;
  qualification?: string | null;
  designation?: string | null;
  phone?: string | null;
  experienceYears?: number;
  specialtiesJson?: string | null;
  bio?: string | null;
  licenseNumber?: string | null;
  stateCouncil?: string | null;
  abdmHprId?: string | null;
  homeVisitAvailable?: boolean;
  shiftStatus?: string | null;
}

export interface PharmacistUpdateInput {
  fullName?: string;
  pharmacyName?: string | null;
  licenseNumber?: string | null;
  pciRegistrationNo?: string | null;
  pharmacyId?: string | null;
  phoneNumber?: string | null;
  pharmacyDetails?: {
    name?: string;
    licenseNumber?: string;
    gstin?: string | null;
    pciNumber?: string | null;
    operatingHours?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    deliveryAvailable?: boolean;
    pickupAvailable?: boolean;
    deliveryFee?: number;
  };
}

export interface CaregiverUpdateInput {
  fullName?: string;
  preferredName?: string | null;
  relationship?: string | null;
  phone?: string | null;
  dateOfBirth?: string | Date | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  caregiverType?: string | null;
  govIdNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
}

export interface InsuranceUpdateInput {
  providerName?: string;
  licenseNumber?: string | null;
  tpaId?: string | null;
  contactPerson?: string | null;
  officerEmpId?: string | null;
  officerDesignation?: string | null;
  claimsClearanceLevel?: string | null;
  officeAddress?: string | null;
  logoUrl?: string | null;
  supportPhone?: string | null;
  supportEmail?: string | null;
}

export class ProfileService {
  /**
   * Get the complete profile for the authenticated user
   */
  static async getCurrentUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phoneNumber: true,
        abhaId: true,
        isActive: true,
        emailVerified: true,
        approvalStatus: true,
        department: true,
        designation: true,
        location: true,
        lastLoginAt: true,
        createdAt: true,
        patient: {
          include: {
            allergies: true,
            conditions: true,
            surgeries: true,
            emergencyContacts: true,
          },
        },
        doctor: {
          include: { availabilities: true },
        },
        nurse: true,
        pharmacist: {
          include: { pharmacy: true },
        },
        caregiver: true,
        insuranceProvider: true,
        preference: true,
      },
    });

    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const roleProfile =
      user.role === Role.DOCTOR ? user.doctor :
        user.role === Role.PATIENT ? user.patient :
          user.role === Role.NURSE ? user.nurse :
            user.role === Role.PHARMACIST ? user.pharmacist :
              user.role === Role.CAREGIVER ? user.caregiver :
                user.role === Role.INSURANCE_PROVIDER ? user.insuranceProvider :
                  {
                    fullName: user.fullName,
                    department: user.department,
                    designation: user.designation,
                    location: user.location,
                    phoneNumber: user.phoneNumber,
                  };

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phoneNumber,
      phoneNumber: user.phoneNumber,
      abhaId: user.abhaId,
      department: user.department,
      designation: user.designation,
      location: user.location,
      lastLoginAt: user.lastLoginAt,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      approvalStatus: user.approvalStatus,
      profile: roleProfile,
      pharmacist: user.pharmacist,
      preference: user.preference,
    };
  }

  // ==========================================
  // USER PREFERENCES (ALL ROLES, 1:1 IN MYSQL)
  // ==========================================
  static async getUserPreferences(userId: string) {
    let pref = await prisma.userPreference.findUnique({ where: { userId } });
    if (!pref) {
      pref = await prisma.userPreference.create({ data: { userId } });
    }
    return {
      id: pref.id,
      userId: pref.userId,
      notifications: pref.notificationPrefsJson ? JSON.parse(pref.notificationPrefsJson) : null,
      privacy: pref.privacyPrefsJson ? JSON.parse(pref.privacyPrefsJson) : null,
      appearance: pref.appearancePrefsJson ? JSON.parse(pref.appearancePrefsJson) : null,
      health: pref.healthPrefsJson ? JSON.parse(pref.healthPrefsJson) : null,
      accessibility: pref.accessibilityPrefsJson ? JSON.parse(pref.accessibilityPrefsJson) : null,
      connectedServices: pref.connectedServicesJson ? JSON.parse(pref.connectedServicesJson) : null,
      emergency: pref.emergencyPrefsJson ? JSON.parse(pref.emergencyPrefsJson) : null,
      twoFactorEnabled: pref.twoFactorEnabled,
      twoFactorMethod: pref.twoFactorMethod,
      updatedAt: pref.updatedAt,
    };
  }

  static async updateUserPreferences(userId: string, body: Record<string, any>, ipAddress?: string) {
    const stringifyIfObj = (val: any) =>
      val === undefined ? undefined : typeof val === 'string' ? val : JSON.stringify(val);

    const data: any = {
      ...(body.notifications !== undefined ? { notificationPrefsJson: stringifyIfObj(body.notifications) } : {}),
      ...(body.privacy !== undefined ? { privacyPrefsJson: stringifyIfObj(body.privacy) } : {}),
      ...(body.appearance !== undefined ? { appearancePrefsJson: stringifyIfObj(body.appearance) } : {}),
      ...(body.health !== undefined ? { healthPrefsJson: stringifyIfObj(body.health) } : {}),
      ...(body.accessibility !== undefined ? { accessibilityPrefsJson: stringifyIfObj(body.accessibility) } : {}),
      ...(body.connectedServices !== undefined ? { connectedServicesJson: stringifyIfObj(body.connectedServices) } : {}),
      ...(body.emergency !== undefined ? { emergencyPrefsJson: stringifyIfObj(body.emergency) } : {}),
      ...(body.twoFactorEnabled !== undefined ? { twoFactorEnabled: Boolean(body.twoFactorEnabled) } : {}),
      ...(body.twoFactorMethod !== undefined ? { twoFactorMethod: String(body.twoFactorMethod) } : {}),
    };

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    await AuditService.log({
      userId,
      action: 'PREFERENCES_UPDATED',
      entityType: 'user_preferences',
      entityId: pref.id,
      ipAddress,
      details: { updatedKeys: Object.keys(body) },
    });

    return this.getUserPreferences(userId);
  }

  // ==========================================
  // PATIENT PROFILE
  // ==========================================
  static async getPatientProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: {
          include: {
            allergies: { orderBy: { createdAt: 'desc' } },
            conditions: { orderBy: { createdAt: 'desc' } },
            surgeries: { orderBy: { createdAt: 'desc' } },
            emergencyContacts: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (user.role === Role.PATIENT) {
      if (user.patient) {
        return {
          ...user.patient,
          email: user.email,
          phoneNumber: user.phoneNumber,
          abhaId: user.abhaId,
        };
      }
      const created = await prisma.patient.create({
        data: {
          userId,
          fullName: user.fullName || user.email.split('@')[0],
        },
      });
      return {
        ...created,
        email: user.email,
        phoneNumber: user.phoneNumber,
        abhaId: user.abhaId,
        allergies: [],
        conditions: [],
        surgeries: [],
        emergencyContacts: [],
      };
    }

    const err: AppError = new Error('Patient profile not found for this user. Specify a valid patient userId.');
    err.statusCode = 404;
    throw err;
  }

  static async updatePatientProfile(
    userId: string,
    data: PatientUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (user.role !== Role.PATIENT) {
      const err: AppError = new Error('Target user is not a patient account');
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (
        data.fullName !== undefined ||
        data.phoneNumber !== undefined ||
        data.abhaId !== undefined
      ) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
            ...(data.abhaId !== undefined ? { abhaId: data.abhaId || null } : {}),
          },
        });
      }

      const patientData: any = {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.dateOfBirth !== undefined
          ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
          : {}),
        ...(data.bloodGroup !== undefined ? { bloodGroup: data.bloodGroup } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.emergencyContactName !== undefined ? { emergencyContactName: data.emergencyContactName } : {}),
        ...(data.emergencyContactPhone !== undefined ? { emergencyContactPhone: data.emergencyContactPhone } : {}),
        ...(data.familyPhone !== undefined ? { familyPhone: data.familyPhone } : {}),
        ...(data.heightCm !== undefined ? { heightCm: data.heightCm != null ? Number(data.heightCm) : null } : {}),
        ...(data.weightKg !== undefined ? { weightKg: data.weightKg != null ? Number(data.weightKg) : null } : {}),
        ...(data.organDonor !== undefined ? { organDonor: Boolean(data.organDonor) } : {}),
        ...(data.preferredHospital !== undefined ? { preferredHospital: data.preferredHospital } : {}),
        ...(data.familyDoctor !== undefined ? { familyDoctor: data.familyDoctor } : {}),
        ...(data.criticalMedicalNotes !== undefined ? { criticalMedicalNotes: data.criticalMedicalNotes } : {}),
        ...(data.preferredPharmacyId !== undefined ? { preferredPharmacyId: data.preferredPharmacyId } : {}),
        ...(data.preferredDeliveryMethod !== undefined ? { preferredDeliveryMethod: data.preferredDeliveryMethod } : {}),
        ...(data.geofenceRadiusMeters !== undefined ? { geofenceRadiusMeters: data.geofenceRadiusMeters } : {}),
        ...(data.lastKnownLocation !== undefined ? { lastKnownLocation: data.lastKnownLocation, lastLocationUpdatedAt: new Date() } : {}),
      };

      return tx.patient.upsert({
        where: { userId },
        create: {
          userId,
          fullName: data.fullName || user.fullName || user.email.split('@')[0],
          ...patientData,
        },
        update: patientData,
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'patients',
      entityId: updated.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // DOCTOR PROFILE
  // ==========================================
  static async getDoctorProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { doctor: { include: { availabilities: true } } },
    });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.doctor) return user.doctor;
    if (user.role !== Role.DOCTOR) {
      const err: AppError = new Error('Doctor profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return prisma.doctor.create({
      data: {
        userId,
        fullName: user.fullName || user.email.split('@')[0],
        speciality: 'General Medicine',
      },
      include: { availabilities: true },
    });
  }

  static async updateDoctorProfile(
    userId: string,
    data: DoctorUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.phoneNumber !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
          },
        });
      }

      const updateFields: any = {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.speciality !== undefined ? { speciality: data.speciality } : {}),
        ...(data.department !== undefined ? { department: data.department } : {}),
        ...(data.qualification !== undefined ? { qualification: data.qualification } : {}),
        ...(data.licenseNumber !== undefined ? { licenseNumber: data.licenseNumber } : {}),
        ...(data.hprAddress !== undefined ? { hprAddress: data.hprAddress } : {}),
        ...(data.hospital !== undefined ? { hospital: data.hospital } : {}),
        ...(data.experienceYears !== undefined ? { experienceYears: Number(data.experienceYears) } : {}),
        ...(data.consultationFee !== undefined ? { consultationFee: Number(data.consultationFee) } : {}),
        ...(data.onlineFee !== undefined ? { onlineFee: data.onlineFee != null ? Number(data.onlineFee) : null } : {}),
        ...(data.inPersonFee !== undefined ? { inPersonFee: data.inPersonFee != null ? Number(data.inPersonFee) : null } : {}),
        ...(data.consultDurationMin !== undefined ? { consultDurationMin: Number(data.consultDurationMin) } : {}),
        ...(data.teleConsultReady !== undefined ? { teleConsultReady: Boolean(data.teleConsultReady) } : {}),
        ...(data.emergencyAvailable !== undefined ? { emergencyAvailable: Boolean(data.emergencyAvailable) } : {}),
        ...(data.languagesJson !== undefined ? { languagesJson: data.languagesJson } : {}),
        ...(data.notificationPrefsJson !== undefined ? { notificationPrefsJson: data.notificationPrefsJson } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
        ...(data.about !== undefined ? { about: data.about } : {}),
      };

      return tx.doctor.upsert({
        where: { userId },
        create: {
          userId,
          fullName: data.fullName || 'Doctor',
          speciality: data.speciality || 'General Medicine',
          ...updateFields,
        },
        update: updateFields,
        include: { availabilities: true },
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'doctors',
      entityId: updated.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // NURSE PROFILE
  // ==========================================
  static async getNurseProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { nurse: true } });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.nurse) return user.nurse;
    if (user.role !== Role.NURSE) {
      const err: AppError = new Error('Nurse profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return prisma.nurse.create({
      data: { userId, fullName: user.fullName || user.email.split('@')[0] },
    });
  }

  static async updateNurseProfile(
    userId: string,
    data: NurseUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updateFields: any = {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.hospital !== undefined ? { hospital: data.hospital } : {}),
      ...(data.department !== undefined ? { department: data.department } : {}),
      ...(data.qualification !== undefined ? { qualification: data.qualification } : {}),
      ...(data.designation !== undefined ? { designation: data.designation } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.experienceYears !== undefined ? { experienceYears: Number(data.experienceYears) } : {}),
      ...(data.specialtiesJson !== undefined ? { specialtiesJson: data.specialtiesJson } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.licenseNumber !== undefined ? { licenseNumber: data.licenseNumber } : {}),
      ...(data.stateCouncil !== undefined ? { stateCouncil: data.stateCouncil } : {}),
      ...(data.abdmHprId !== undefined ? { abdmHprId: data.abdmHprId } : {}),
      ...(data.homeVisitAvailable !== undefined ? { homeVisitAvailable: Boolean(data.homeVisitAvailable) } : {}),
      ...(data.shiftStatus !== undefined ? { shiftStatus: data.shiftStatus } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phone !== undefined ? { phoneNumber: data.phone } : {}),
          },
        });
      }
      return tx.nurse.upsert({
        where: { userId },
        create: { userId, fullName: data.fullName || 'Nurse', ...updateFields },
        update: updateFields,
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'nurses',
      entityId: updated.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // PHARMACIST PROFILE (+ LINKED PHARMACY)
  // ==========================================
  static async getPharmacistProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { pharmacist: { include: { pharmacy: true } } },
    });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.pharmacist) return user.pharmacist;
    if (user.role !== Role.PHARMACIST) {
      const err: AppError = new Error('Pharmacist profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return prisma.pharmacist.create({
      data: { userId, fullName: user.fullName || user.email.split('@')[0] },
      include: { pharmacy: true },
    });
  }

  static async updatePharmacistProfile(
    userId: string,
    data: PharmacistUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.phoneNumber !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
          },
        });
      }

      // Security: Never allow a pharmacist to self-reassign pharmacyId to another pharmacy tenant
      const pharm = await tx.pharmacist.upsert({
        where: { userId },
        create: {
          userId,
          fullName: data.fullName || 'Pharmacist',
          pharmacyName: data.pharmacyName || null,
          licenseNumber: data.licenseNumber || null,
          pciRegistrationNo: data.pciRegistrationNo || null,
          pharmacyId: null,
        },
        update: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.pharmacyName !== undefined ? { pharmacyName: data.pharmacyName } : {}),
          ...(data.licenseNumber !== undefined ? { licenseNumber: data.licenseNumber } : {}),
          ...(data.pciRegistrationNo !== undefined ? { pciRegistrationNo: data.pciRegistrationNo } : {}),
        },
        include: { pharmacy: true },
      });

      if (data.pharmacyDetails && pharm.pharmacyId) {
        const pd = data.pharmacyDetails;
        await tx.pharmacy.update({
          where: { id: pharm.pharmacyId },
          data: {
            ...(pd.name !== undefined ? { name: pd.name } : {}),
            ...(pd.licenseNumber !== undefined ? { licenseNumber: pd.licenseNumber } : {}),
            ...(pd.gstin !== undefined ? { gstin: pd.gstin } : {}),
            ...(pd.pciNumber !== undefined ? { pciNumber: pd.pciNumber } : {}),
            ...(pd.operatingHours !== undefined ? { operatingHours: pd.operatingHours } : {}),
            ...(pd.address !== undefined ? { address: pd.address } : {}),
            ...(pd.city !== undefined ? { city: pd.city } : {}),
            ...(pd.state !== undefined ? { state: pd.state } : {}),
            ...(pd.pincode !== undefined ? { pincode: pd.pincode } : {}),
            ...(pd.phone !== undefined ? { phone: pd.phone } : {}),
            ...(pd.email !== undefined ? { email: pd.email } : {}),
            ...(pd.deliveryAvailable !== undefined ? { deliveryAvailable: pd.deliveryAvailable } : {}),
            ...(pd.pickupAvailable !== undefined ? { pickupAvailable: pd.pickupAvailable } : {}),
            ...(pd.deliveryFee !== undefined ? { deliveryFee: pd.deliveryFee } : {}),
          },
        });
        if (pd.name) {
          await tx.pharmacist.update({
            where: { id: pharm.id },
            data: { pharmacyName: pd.name },
          });
        }
      }

      return tx.pharmacist.findUnique({
        where: { userId },
        include: { pharmacy: true },
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'pharmacists',
      entityId: updated?.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // CAREGIVER PROFILE
  // ==========================================
  static async getCaregiverProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { caregiver: true } });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.caregiver) return user.caregiver;
    if (user.role !== Role.CAREGIVER) {
      const err: AppError = new Error('Caregiver profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return prisma.caregiver.create({
      data: { userId, fullName: user.fullName || user.email.split('@')[0] },
    });
  }

  static async updateCaregiverProfile(
    userId: string,
    data: CaregiverUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updateFields: any = {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.preferredName !== undefined ? { preferredName: data.preferredName } : {}),
      ...(data.relationship !== undefined ? { relationship: data.relationship } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.dateOfBirth !== undefined
        ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
        : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.caregiverType !== undefined ? { caregiverType: data.caregiverType } : {}),
      ...(data.govIdNumber !== undefined ? { govIdNumber: data.govIdNumber } : {}),
      ...(data.emergencyContactName !== undefined ? { emergencyContactName: data.emergencyContactName } : {}),
      ...(data.emergencyContactRelation !== undefined ? { emergencyContactRelation: data.emergencyContactRelation } : {}),
      ...(data.emergencyContactPhone !== undefined ? { emergencyContactPhone: data.emergencyContactPhone } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
            ...(data.phone !== undefined ? { phoneNumber: data.phone } : {}),
          },
        });
      }
      return tx.caregiver.upsert({
        where: { userId },
        create: { userId, fullName: data.fullName || 'Caregiver', ...updateFields },
        update: updateFields,
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'caregivers',
      entityId: updated.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // INSURANCE PROVIDER PROFILE
  // ==========================================
  static async getInsuranceProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { insuranceProvider: { include: { tpaSetting: true } } },
    });
    if (!user) {
      const err: AppError = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.insuranceProvider) return user.insuranceProvider;
    if (user.role !== Role.INSURANCE_PROVIDER) {
      const err: AppError = new Error('Insurance provider profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return prisma.insuranceProvider.create({
      data: { userId, providerName: user.fullName || user.email.split('@')[0] },
      include: { tpaSetting: true },
    });
  }

  static async updateInsuranceProfile(
    userId: string,
    data: InsuranceUpdateInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updateFields: any = {
      ...(data.providerName !== undefined ? { providerName: data.providerName } : {}),
      ...(data.licenseNumber !== undefined ? { licenseNumber: data.licenseNumber } : {}),
      ...(data.tpaId !== undefined ? { tpaId: data.tpaId } : {}),
      ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
      ...(data.officerEmpId !== undefined ? { officerEmpId: data.officerEmpId } : {}),
      ...(data.officerDesignation !== undefined ? { officerDesignation: data.officerDesignation } : {}),
      ...(data.claimsClearanceLevel !== undefined ? { claimsClearanceLevel: data.claimsClearanceLevel } : {}),
      ...(data.officeAddress !== undefined ? { officeAddress: data.officeAddress } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.supportPhone !== undefined ? { supportPhone: data.supportPhone } : {}),
      ...(data.supportEmail !== undefined ? { supportEmail: data.supportEmail } : {}),
    };

    const updated = await prisma.insuranceProvider.upsert({
      where: { userId },
      create: {
        userId,
        providerName: data.providerName || 'Insurance Provider',
        ...updateFields,
      },
      update: updateFields,
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'insurance_providers',
      entityId: updated.id,
      ipAddress,
      details: { targetUserId: userId, updatedFields: Object.keys(data) },
    });

    return updated;
  }

  // ==========================================
  // GENERIC / ADMIN ACCOUNT PROFILE UPDATE
  // ==========================================
  static async updateAdminAccountProfile(
    userId: string,
    data: { fullName?: string; phoneNumber?: string; department?: string; designation?: string; location?: string },
    actorId: string,
    ipAddress?: string
  ) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
        ...(data.department !== undefined ? { department: data.department } : {}),
        ...(data.designation !== undefined ? { designation: data.designation } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phoneNumber: true,
        department: true,
        designation: true,
        location: true,
        lastLoginAt: true,
      },
    });

    await AuditService.log({
      userId: actorId,
      action: 'PROFILE_UPDATED',
      entityType: 'users',
      entityId: updated.id,
      ipAddress,
      details: { updatedFields: Object.keys(data) },
    });

    return updated;
  }
}
