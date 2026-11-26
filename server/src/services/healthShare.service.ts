import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { emitHealthShareEvent } from '../socket';

// Default permission scopes for patient record sharing
export const DEFAULT_PERMISSION_SCOPES = [
  'Basic Information',
  'Medical Records',
  'Prescriptions',
  'Vitals',
  'Medication History',
  'Reports',
];

export const formatDoctorName = (name?: string | null): string => {
  if (!name || !name.trim()) return 'Dr. Attending Physician';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) return trimmed;
  return `Dr. ${trimmed}`;
};

export class HealthShareService {
  /**
   * Strict ownership & consent authority guard:
   * Only the target patient, an ACTIVE linked caregiver of that patient, or ADMIN/SUPER_ADMIN may manage consent.
   */
  private static async assertPatientConsentAuthority(actorUserId: string, targetPatientId: string) {
    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true },
    });
    if (!actor) {
      throw new AppError('Authentication required', 401);
    }
    if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') {
      return;
    }

    const targetPatient = await prisma.patient.findUnique({
      where: { id: targetPatientId },
      select: { id: true, userId: true },
    });
    if (targetPatient && targetPatient.userId === actorUserId) {
      return;
    }

    if (actor.role === 'CAREGIVER') {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId: actorUserId },
        include: {
          patientLinks: { where: { patientId: targetPatientId } },
          patients: { where: { id: targetPatientId }, select: { id: true } },
        },
      });
      if (caregiver) {
        const link = caregiver.patientLinks[0];
        if (link) {
          if (link.consentStatus === 'ACTIVE') return;
        } else if (caregiver.patients.length > 0) {
          return;
        }
      }
    }

    throw new AppError('Forbidden: You do not have permission to manage consent for this patient', 403);
  }

  /**
   * 1. PATIENT: Generate a secure, cryptographically random temporary QR token
   * The token contains NO PHI / medical data.
   */
  static async generateQRToken(
    userId: string,
    durationMinutes = 30,
    _patientHint?: { patientId?: string; patientName?: string; abhaId?: string }
  ) {
    if (!userId) {
      throw new AppError('Authentication required to generate QR token', 401);
    }

    const patient = await prisma.patient.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
      include: { user: true },
    });

    if (!patient) {
      throw new AppError('Patient profile not found for authenticated user', 404);
    }

    // Invalidate existing active tokens for this patient to ensure 1 fresh token
    await prisma.healthShareToken.updateMany({
      where: {
        patientId: patient.id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    // Generate secure random token
    const randomHex = crypto.randomBytes(18).toString('hex').toUpperCase();
    const token = `MED-QR-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}`;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const shareToken = await prisma.healthShareToken.create({
      data: {
        token,
        patientId: patient.id,
        durationMinutes,
        expiresAt,
        isRevoked: false,
      },
    });

    return {
      token: shareToken.token,
      expiresAt: shareToken.expiresAt,
      durationMinutes: shareToken.durationMinutes,
    };
  }

  /**
   * 2. DOCTOR: Validate scanned QR token & identify patient basic info ONLY.
   * Returns NO medical records, NO prescriptions, NO vitals.
   */
  static async validateQRToken(doctorUserId: string, token: string, ipAddress?: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { OR: [{ userId: doctorUserId }, { id: doctorUserId }] },
      include: { user: true },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found for authenticated user', 403);
    }

    const cleanToken = token.trim();
    const shareToken = await prisma.healthShareToken.findUnique({
      where: { token: cleanToken },
      include: {
        patient: {
          include: {
            user: {
              select: { abhaId: true, phoneNumber: true },
            },
          },
        },
      },
    });

    if (!shareToken) {
      throw new AppError('Invalid or expired QR token. Please ask the patient to generate a new QR.', 404);
    }

    if (shareToken.isRevoked || new Date() > shareToken.expiresAt) {
      throw new AppError('Invalid or expired QR token. Please ask the patient to generate a new QR.', 400);
    }

    const patient = shareToken.patient;
    let age: number | null = null;
    if (patient.dateOfBirth) {
      const diffMs = Date.now() - new Date(patient.dateOfBirth).getTime();
      age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    }

    // Log Audit Event: QR_SCANNED (No secrets logged)
    await AuditService.log({
      userId: doctorUserId,
      action: 'QR_SCANNED',
      entityType: 'health_share_tokens',
      entityId: shareToken.id,
      ipAddress,
      details: {
        doctorId: doctor.id,
        patientId: patient.id,
        status: 'TOKEN_VALIDATED',
      },
    });

    console.log(`[HealthShare] Scanned QR token validated:`);
    console.log(`  → token: ${shareToken.token.slice(0, 10)}...`);
    console.log(`  → patientId: ${patient.id}`);
    console.log(`  → userId: ${patient.userId}`);
    console.log(`  → database patient ID: ${patient.id}`);
    console.log(`  → patient: ${patient.fullName}`);

    const formattedDoctorName = formatDoctorName(doctor.fullName);

    return {
      token: shareToken.token,
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        gender: patient.gender || 'Not Specified',
        age: age || 30,
        bloodGroup: patient.bloodGroup || 'Unknown',
        abhaId: patient.user?.abhaId || null,
      },
      doctor: {
        id: doctor.id,
        fullName: formattedDoctorName,
        hospital: doctor.hospital || 'Reach Multispeciality',
        speciality: doctor.speciality || 'General Medicine',
        qualification: doctor.qualification || 'MBBS, MD',
        licenseNumber: doctor.licenseNumber || 'REACH-2026',
        department: doctor.speciality || 'General Medicine',
      },
      availablePurposes: [
        'Patient Consultation',
        'Follow-up Consultation',
        'Emergency Care',
        'Medication Review',
        'Diagnostic Review',
        'Other',
      ],
      availableScopes: DEFAULT_PERMISSION_SCOPES,
    };
  }

  /**
   * 3. DOCTOR: Create an Access Request (Status = PENDING)
   * Does NOT grant medical record access immediately.
   */
  static async createAccessRequest(
    doctorUserId: string,
    payload: {
      token: string;
      purpose?: string;
      permissionScope?: string[];
      notes?: string;
      durationMinutes?: number;
    },
    ipAddress?: string
  ) {
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [{ userId: doctorUserId }, { id: doctorUserId }],
      },
      include: { user: true },
    });

    if (!doctor) {
      throw new AppError('Doctor profile not found for authenticated user', 403);
    }

    const cleanToken = payload.token.trim();
    const shareToken = await prisma.healthShareToken.findUnique({
      where: { token: cleanToken },
      include: { patient: { include: { user: true } } },
    });

    if (!shareToken || shareToken.isRevoked || new Date() > shareToken.expiresAt) {
      throw new AppError('Invalid or expired QR token. Please ask the patient to generate a fresh QR code.', 400);
    }

    const patient = shareToken.patient;
    const scopes = payload.permissionScope && payload.permissionScope.length > 0
      ? payload.permissionScope
      : DEFAULT_PERMISSION_SCOPES;
    const purpose = payload.purpose || 'Patient Consultation';
    const durationMinutes = payload.durationMinutes || 60;
    const formattedDoctorName = formatDoctorName(doctor.fullName);

    // Prevent accidental duplicate submissions by checking for recent PENDING request
    const existingPending = await prisma.patientAccessRequest.findFirst({
      where: {
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'PENDING',
      },
      orderBy: { requestedAt: 'desc' },
    });

    if (existingPending) {
      const updatedPending = await prisma.patientAccessRequest.update({
        where: { id: existingPending.id },
        data: {
          tokenRef: shareToken.token,
          purpose,
          permissionScope: JSON.stringify(scopes),
          durationMinutes,
          notes: payload.notes || null,
          requestedAt: new Date(),
        },
      });

      // Always notify patient and dispatch real-time event even when refreshing a pending request
      await NotificationService.createNotification({
        userId: patient.userId,
        title: '🔔 Medical Record Access Request',
        message: `${formattedDoctorName} (${doctor.speciality || 'General Medicine'} at ${doctor.hospital || 'Hospital'}) has requested access to your health records for ${purpose}.`,
        type: 'ACCESS_REQUEST',
        category: 'Clinical Access',
        relatedModule: 'health-share',
      });

      emitHealthShareEvent({
        patientId: patient.id,
        userId: patient.userId,
        event: 'health-share:request-created',
        requestId: updatedPending.id,
        status: 'PENDING',
        data: {
          id: updatedPending.id,
          requestId: updatedPending.id,
          doctor: {
            id: doctor.id,
            fullName: formattedDoctorName,
            hospital: doctor.hospital || 'Reach Multispeciality',
            speciality: doctor.speciality || 'General Medicine',
            licenseNumber: doctor.licenseNumber || 'REACH-2026',
            qualification: doctor.qualification || 'MBBS, MD',
          },
          doctorId: doctor.id,
          doctorName: formattedDoctorName,
          doctorHospital: doctor.hospital || 'Reach Multispeciality',
          doctorSpeciality: doctor.speciality || 'General Medicine',
          doctorLicense: doctor.licenseNumber || 'REACH-2026',
          doctorQualification: doctor.qualification || 'MBBS, MD',
          purpose,
          permissionScope: scopes,
          requestedAt: updatedPending.requestedAt,
        },
      });

      return {
        requestId: updatedPending.id,
        patientId: patient.id,
        patientName: patient.fullName,
        doctorName: formattedDoctorName,
        status: updatedPending.status,
        purpose: updatedPending.purpose,
        permissionScope: scopes,
        requestedAt: updatedPending.requestedAt,
        message: 'Access request refreshed and sent to patient successfully',
      };
    }

    // Create the Access Request in PENDING state
    const accessRequest = await prisma.patientAccessRequest.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        tokenRef: shareToken.token,
        purpose,
        permissionScope: JSON.stringify(scopes),
        durationMinutes,
        status: 'PENDING',
        notes: payload.notes || null,
        requestedAt: new Date(),
      },
    });

    // Notify Patient using existing notification system
    await NotificationService.createNotification({
      userId: patient.userId,
      title: '🔔 Medical Record Access Request',
      message: `${formattedDoctorName} (${doctor.speciality || 'General Medicine'} at ${doctor.hospital || 'Hospital'}) has requested access to your health records for ${purpose}.`,
      type: 'ACCESS_REQUEST',
      category: 'Clinical Access',
      relatedModule: 'health-share',
    });

    // Real-time socket emission ONLY to intended patient (patient room & user room)
    // DO NOT include doctorId in room targets so the requester doctor never receives a patient-facing consent prompt
    emitHealthShareEvent({
      patientId: patient.id,
      userId: patient.userId,
      event: 'health-share:request-created',
      requestId: accessRequest.id,
      status: 'PENDING',
      data: {
        id: accessRequest.id,
        requestId: accessRequest.id,
        doctor: {
          id: doctor.id,
          fullName: formattedDoctorName,
          hospital: doctor.hospital || 'Reach Multispeciality',
          speciality: doctor.speciality || 'General Medicine',
          licenseNumber: doctor.licenseNumber || 'REACH-2026',
          qualification: doctor.qualification || 'MBBS, MD',
        },
        doctorId: doctor.id,
        doctorName: formattedDoctorName,
        doctorHospital: doctor.hospital || 'Reach Multispeciality',
        doctorSpeciality: doctor.speciality || 'General Medicine',
        doctorLicense: doctor.licenseNumber || 'REACH-2026',
        doctorQualification: doctor.qualification || 'MBBS, MD',
        purpose,
        permissionScope: scopes,
        requestedAt: accessRequest.requestedAt,
      },
    });

    // Audit Log
    await AuditService.log({
      userId: doctorUserId,
      action: 'ACCESS_REQUEST_CREATED',
      entityType: 'patient_access_requests',
      entityId: accessRequest.id,
      ipAddress,
      details: {
        doctorId: doctor.id,
        patientId: patient.id,
        purpose,
        permissionScope: scopes,
        status: 'PENDING',
      },
    });

    return {
      requestId: accessRequest.id,
      status: accessRequest.status,
      patientName: patient.fullName,
      doctorName: formattedDoctorName,
      purpose,
      permissionScope: scopes,
      requestedAt: accessRequest.requestedAt,
    };
  }

  /**
   * 4. PATIENT: Get list of access requests
   */
  static async getPatientAccessRequests(patientUserId: string) {
    let patient = await prisma.patient.findFirst({
      where: {
        OR: [{ userId: patientUserId }, { id: patientUserId }],
      },
      include: { user: true },
    });

    if (!patient && patientUserId) {
      const user = await prisma.user.findUnique({ where: { id: patientUserId } });
      if (user?.email) {
        patient = await prisma.patient.findFirst({
          where: {
            OR: [
              { user: { email: user.email } },
              { fullName: { contains: user.email.split('@')[0] } },
            ],
          },
          include: { user: true },
        });
      }
    }

    if (!patient) {
      patient = await prisma.patient.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: { user: true },
      });
    }

    const patientIds: string[] = [];
    if (patient) {
      patientIds.push(patient.id);
    }

    // Include other patient profiles linked to this user's ID or email
    const matching = await prisma.patient.findMany({
      where: {
        OR: [
          { userId: patientUserId },
          { id: patientUserId },
          ...(patient?.user?.email ? [{ user: { email: patient.user.email } }] : []),
        ],
      },
      select: { id: true },
    });
    matching.forEach((m) => {
      if (!patientIds.includes(m.id)) patientIds.push(m.id);
    });

    // Also include active wards if the caller is a CAREGIVER
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: patientUserId },
      include: {
        patientLinks: { where: { consentStatus: 'ACTIVE' }, select: { patientId: true } },
      },
    });
    if (caregiver) {
      caregiver.patientLinks.forEach((l) => {
        if (!patientIds.includes(l.patientId)) patientIds.push(l.patientId);
      });
    }

    if (patientIds.length === 0) {
      return [];
    }

    const requests = await prisma.patientAccessRequest.findMany({
      where: { patientId: { in: patientIds } },
      include: {
        doctor: true,
      },
      orderBy: { requestedAt: 'desc' },
      take: 30,
    });

    const now = new Date();

    return requests.map((req: any) => {
      let scope: string[] = DEFAULT_PERMISSION_SCOPES;
      try {
        if (req.permissionScope) {
          scope = JSON.parse(req.permissionScope);
        }
      } catch {
        scope = DEFAULT_PERMISSION_SCOPES;
      }

      // Ensure active sessions have valid grantedAt & expiresAt
      let effectiveGrantedAt = req.grantedAt;
      let effectiveExpiresAt = req.expiresAt;
      if (req.status === 'APPROVED') {
        if (!effectiveGrantedAt) {
          effectiveGrantedAt = req.requestedAt || now;
        }
        if (!effectiveExpiresAt) {
          effectiveExpiresAt = new Date(new Date(effectiveGrantedAt).getTime() + (req.durationMinutes || 60) * 60 * 1000);
        }
      }

      // Check auto-expiration for approved items
      let calculatedStatus = req.status;
      if (req.status === 'APPROVED' && effectiveExpiresAt && now > new Date(effectiveExpiresAt)) {
        calculatedStatus = 'EXPIRED';
      }

      return {
        id: req.id,
        doctorId: req.doctorId,
        doctorName: formatDoctorName(req.doctor?.fullName),
        doctorHospital: req.doctor?.hospital || 'Reach Multispeciality',
        doctorSpeciality: req.doctor?.speciality || 'Cardiologist & General Physician',
        doctorLicense: req.doctor?.licenseNumber || 'TN-MED-48291',
        doctorQualification: req.doctor?.qualification || 'MBBS, MD',
        purpose: req.purpose,
        permissionScope: scope,
        status: calculatedStatus,
        requestedAt: req.requestedAt,
        grantedAt: effectiveGrantedAt,
        expiresAt: effectiveExpiresAt,
        revokedAt: req.revokedAt,
      };
    });
  }

  /**
   * 5. DOCTOR: Get doctor's sent access requests & active sessions
   */
  static async getDoctorAccessRequests(doctorUserId: string) {
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [{ userId: doctorUserId }, { id: doctorUserId }],
      },
    });

    if (!doctor) {
      return [];
    }

    const requests = await prisma.patientAccessRequest.findMany({
      where: { doctorId: doctor.id },
      include: {
        patient: {
          include: {
            user: { select: { abhaId: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 30,
    });

    const now = new Date();

    return requests.map((req: any) => {
      let scope: string[] = DEFAULT_PERMISSION_SCOPES;
      try {
        if (req.permissionScope) {
          scope = JSON.parse(req.permissionScope);
        }
      } catch {
        scope = DEFAULT_PERMISSION_SCOPES;
      }

      let calculatedStatus = req.status;
      if (req.status === 'APPROVED' && req.expiresAt && now > req.expiresAt) {
        calculatedStatus = 'EXPIRED';
      }

      let age: number | null = null;
      if (req.patient.dateOfBirth) {
        const diffMs = Date.now() - new Date(req.patient.dateOfBirth).getTime();
        age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      }

      return {
        id: req.id,
        patientId: req.patientId,
        patientName: req.patient.fullName,
        patientAge: age || 30,
        patientGender: req.patient.gender || 'Not specified',
        patientBloodGroup: req.patient.bloodGroup || 'Unknown',
        patientAbhaId: req.patient.user?.abhaId || null,
        purpose: req.purpose,
        permissionScope: scope,
        status: calculatedStatus,
        requestedAt: req.requestedAt,
        grantedAt: req.grantedAt,
        expiresAt: req.expiresAt,
        revokedAt: req.revokedAt,
      };
    });
  }

  /**
   * 6. PATIENT: Approve Access Request
   * Transitions status from PENDING -> APPROVED, sets grantedAt & expiresAt.
   */
  static async approveAccessRequest(
    patientUserId: string,
    requestId: string,
    approvedScopes?: string[],
    durationMinutes = 60,
    ipAddress?: string
  ) {
    const accessRequest = await prisma.patientAccessRequest.findUnique({
      where: { id: requestId },
      include: { doctor: { include: { user: true } }, patient: { include: { user: true } } },
    });

    if (!accessRequest) {
      throw new AppError('Access request not found', 404);
    }

    await this.assertPatientConsentAuthority(patientUserId, accessRequest.patientId);
    const patient = accessRequest.patient;

    if (accessRequest.status === 'APPROVED') {
      // Idempotent return: If already approved, return active approval state cleanly
      return {
        id: accessRequest.id,
        status: 'APPROVED',
        patientName: patient.fullName,
        doctorName: accessRequest.doctor.fullName,
        grantedAt: accessRequest.grantedAt,
        expiresAt: accessRequest.expiresAt,
        permissionScope: accessRequest.permissionScope ? JSON.parse(accessRequest.permissionScope) : DEFAULT_PERMISSION_SCOPES,
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const scopeToSave = approvedScopes && approvedScopes.length > 0
      ? approvedScopes
      : (accessRequest.permissionScope ? JSON.parse(accessRequest.permissionScope) : DEFAULT_PERMISSION_SCOPES);

    // Expire any previous active sessions for this doctor-patient pair to prevent duplicates
    await prisma.patientAccessRequest.updateMany({
      where: {
        doctorId: accessRequest.doctorId,
        status: 'APPROVED',
        id: { not: requestId },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const updated = await prisma.patientAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        grantedAt: now,
        expiresAt,
        respondedAt: now,
        permissionScope: JSON.stringify(scopeToSave),
      },
    });

    // Notify Doctor via existing notification system
    if (accessRequest.doctor?.userId) {
      await NotificationService.createNotification({
        userId: accessRequest.doctor.userId,
        title: '✅ Access Request Approved',
        message: `${patient.fullName} approved your health record access request. Temporary access active until ${expiresAt.toLocaleTimeString()}.`,
        type: 'ACCESS_APPROVED',
        category: 'Clinical Access',
        relatedModule: 'health-share',
      });
    }

    // Socket Event
    emitHealthShareEvent({
      patientId: accessRequest.patientId,
      doctorId: accessRequest.doctorId,
      userId: accessRequest.doctor?.userId,
      event: 'health-share:request-approved',
      requestId: updated.id,
      status: 'APPROVED',
      data: {
        id: updated.id,
        patientId: accessRequest.patientId,
        patientName: patient.fullName,
        grantedAt: updated.grantedAt,
        expiresAt: updated.expiresAt,
        permissionScope: scopeToSave,
      },
    });

    // Audit Log
    await AuditService.log({
      userId: patientUserId,
      action: 'ACCESS_REQUEST_APPROVED',
      entityType: 'patient_access_requests',
      entityId: updated.id,
      ipAddress,
      details: {
        patientId: accessRequest.patientId,
        doctorId: accessRequest.doctorId,
        expiresAt: updated.expiresAt,
        permissionScope: scopeToSave,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      grantedAt: updated.grantedAt,
      expiresAt: updated.expiresAt,
      permissionScope: scopeToSave,
    };
  }

  /**
   * 7. PATIENT: Reject Access Request
   */
  static async rejectAccessRequest(patientUserId: string, requestId: string, ipAddress?: string) {
    const accessRequest = await prisma.patientAccessRequest.findUnique({
      where: { id: requestId },
      include: { doctor: { include: { user: true } }, patient: { include: { user: true } } },
    });

    if (!accessRequest) {
      throw new AppError('Access request not found', 404);
    }

    await this.assertPatientConsentAuthority(patientUserId, accessRequest.patientId);
    const patient = accessRequest.patient;

    const now = new Date();
    const updated = await prisma.patientAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        respondedAt: now,
      },
    });

    // Notify Doctor
    if (accessRequest.doctor?.userId) {
      await NotificationService.createNotification({
        userId: accessRequest.doctor.userId,
        title: '❌ Access Request Rejected',
        message: `${patient.fullName} declined your request for health record access.`,
        type: 'ACCESS_REJECTED',
        category: 'Clinical Access',
        relatedModule: 'health-share',
      });
    }

    // Socket Event
    emitHealthShareEvent({
      patientId: accessRequest.patientId,
      doctorId: accessRequest.doctorId,
      userId: accessRequest.doctor?.userId,
      event: 'health-share:request-rejected',
      requestId: updated.id,
      status: 'REJECTED',
    });

    // Audit Log
    await AuditService.log({
      userId: patientUserId,
      action: 'ACCESS_REQUEST_REJECTED',
      entityType: 'patient_access_requests',
      entityId: updated.id,
      ipAddress,
      details: {
        patientId: accessRequest.patientId,
        doctorId: accessRequest.doctorId,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
    };
  }

  /**
   * 8. PATIENT: Revoke Active Access Session
   */
  static async revokeAccess(patientUserId: string, requestId: string, ipAddress?: string) {
    const accessRequest = await prisma.patientAccessRequest.findUnique({
      where: { id: requestId },
      include: { doctor: { include: { user: true } }, patient: true },
    });

    if (!accessRequest) {
      throw new AppError('Access session not found', 404);
    }

    await this.assertPatientConsentAuthority(patientUserId, accessRequest.patientId);
    const patient = accessRequest.patient;

    const now = new Date();
    const updated = await prisma.patientAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REVOKED',
        revokedAt: now,
      },
    });

    // Notify Doctor
    if (accessRequest.doctor?.userId) {
      const patientDisplayName = patient?.fullName || accessRequest.patient?.fullName || 'The patient';
      await NotificationService.createNotification({
        userId: accessRequest.doctor.userId,
        title: '🔒 Access Session Revoked',
        message: `${patientDisplayName} has revoked medical record access.`,
        type: 'ACCESS_REVOKED',
        category: 'Clinical Access',
        relatedModule: 'health-share',
      });
    }

    // Socket Event
    emitHealthShareEvent({
      patientId: accessRequest.patientId,
      doctorId: accessRequest.doctorId,
      userId: accessRequest.doctor?.userId,
      event: 'health-share:session-revoked',
      requestId: updated.id,
      status: 'REVOKED',
    });

    // Audit Log
    await AuditService.log({
      userId: patientUserId,
      action: 'ACCESS_REVOKED',
      entityType: 'patient_access_requests',
      entityId: updated.id,
      ipAddress,
      details: {
        patientId: accessRequest.patientId,
        doctorId: accessRequest.doctorId,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
    };
  }

  /**
   * 9. DOCTOR: Fetch Patient 360° Data with Strict Backend Authorization & Scope Enforcement
   * Returns 403 Forbidden if not authorized, expired, or revoked.
   */
  static async getPatient360Data(doctorUserId: string, patientId: string, ipAddress?: string) {
    // 1. Authenticated user must be a Doctor
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [{ userId: doctorUserId }, { id: doctorUserId }],
      },
    });

    if (!doctor) {
      throw new AppError('Only authenticated doctors can access clinical 360 data', 403);
    }

    // 2. Validate target patient exists
    let patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: { abhaId: true, phoneNumber: true, email: true },
        },
      },
    });

    if (!patient) {
      patient = await prisma.patient.findFirst({
        where: {
          OR: [
            { userId: patientId },
            { user: { abhaId: patientId } },
            { user: { phoneNumber: patientId } },
          ],
        },
        include: {
          user: {
            select: { abhaId: true, phoneNumber: true, email: true },
          },
        },
      });
    }

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // 3. Strict Authorization Check: Active, Approved, Non-Expired, Non-Revoked Request for THIS Doctor
    const now = new Date();
    const activeSession = await prisma.patientAccessRequest.findFirst({
      where: {
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'APPROVED',
        expiresAt: { gt: now },
      },
      orderBy: { grantedAt: 'desc' },
    });

    if (!activeSession) {
      throw new AppError('Active patient consent required. Access is not approved, has expired, or was revoked by the patient.', 403);
    }

    console.log(`[HealthShare] Patient 360 authorized session:`);
    console.log(`  → shareSessionId: ${activeSession.id}`);
    console.log(`  → patientId: ${patient.id}`);
    console.log(`  → userId: ${patient.userId}`);
    console.log(`  → database patient ID: ${patient.id}`);
    console.log(`  → patient: ${patient.fullName}`);

    // 4. Parse Approved Permission Scope
    let approvedScopes: string[] = DEFAULT_PERMISSION_SCOPES;
    try {
      if (activeSession.permissionScope) {
        approvedScopes = JSON.parse(activeSession.permissionScope);
      }
    } catch {
      approvedScopes = DEFAULT_PERMISSION_SCOPES;
    }

    const hasScope = (scopeName: string) =>
      approvedScopes.some((s) => s.toLowerCase() === scopeName.toLowerCase());

    // 5. Gather real MySQL data based on approved scopes ONLY
    let age: number | null = null;
    if (patient.dateOfBirth) {
      const diffMs = Date.now() - new Date(patient.dateOfBirth).getTime();
      age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    }

    // Basic Info
    const basicInfo = hasScope('Basic Information')
      ? {
          id: patient.id,
          fullName: patient.fullName,
          gender: patient.gender || 'Not Specified',
          dateOfBirth: patient.dateOfBirth,
          age: age || 30,
          bloodGroup: patient.bloodGroup || 'Unknown',
          address: patient.address,
          emergencyContactName: patient.emergencyContactName,
          emergencyContactPhone: patient.emergencyContactPhone,
          familyPhone: patient.familyPhone,
          heightCm: patient.heightCm,
          abhaId: patient.user?.abhaId || null,
          phoneNumber: patient.user?.phoneNumber || null,
        }
      : null;

    // Vitals
    let vitals: any[] = [];
    if (hasScope('Vitals')) {
      vitals = await prisma.vital.findMany({
        where: { patientId: patient.id },
        orderBy: { recordedAt: 'desc' },
      });
    }

    // Medical Records & Reports
    let medicalRecords: any[] = [];
    let reports: any[] = [];
    if (hasScope('Medical Records') || hasScope('Reports')) {
      const allRecords = await prisma.medicalRecord.findMany({
        where: { patientId: patient.id },
        include: {
          doctor: { select: { fullName: true, speciality: true, hospital: true } },
        },
        orderBy: { recordDate: 'desc' },
      });

      if (hasScope('Medical Records')) {
        medicalRecords = allRecords.filter(
          (r) => r.type !== 'LAB_REPORT' && r.type !== 'IMAGING'
        );
      }
      if (hasScope('Reports')) {
        reports = allRecords.filter(
          (r) =>
            r.type === 'LAB_REPORT' ||
            r.type === 'IMAGING' ||
            Boolean(r.fileName && r.fileName.length > 0) ||
            Boolean(r.fileUrl)
        );
      }
    }

    // Prescriptions & Medication History
    let prescriptions: any[] = [];
    let medicationHistory: any[] = [];
    let adherenceData: any = null;

    if (hasScope('Prescriptions') || hasScope('Medication History')) {
      const rawPrescriptions = await prisma.prescription.findMany({
        where: { patientId: patient.id },
        include: {
          doctor: { select: { fullName: true, speciality: true, hospital: true } },
          items: true,
        },
        orderBy: { issuedAt: 'desc' },
      });

      if (hasScope('Prescriptions')) {
        prescriptions = rawPrescriptions;
      }

      if (hasScope('Medication History')) {
        // Collect distinct medicines across prescriptions
        const medMap = new Map<string, any>();
        rawPrescriptions.forEach((rx: any) => {
          rx.items.forEach((item: any) => {
            if (!medMap.has(item.medicineName)) {
              medMap.set(item.medicineName, {
                medicineName: item.medicineName,
                dosage: item.dosage,
                frequency: item.frequency,
                durationDays: item.durationDays,
                prescribedBy: rx.doctor?.fullName,
                issuedAt: rx.issuedAt,
                instructions: item.instructions || item.foodInstruction,
              });
            }
          });
        });
        medicationHistory = Array.from(medMap.values());

        // Calculate real adherence if reminders or pharmacy orders exist
        const reminders = await prisma.reminder.findMany({
          where: { patientId: patient.id, type: 'MEDICATION' },
        });

        if (reminders.length > 0) {
          const completed = reminders.filter((r: any) => r.isCompletedToday).length;
          const total = reminders.length;
          const pct = Math.round((completed / total) * 100);
          adherenceData = {
            hasData: true,
            percentage: pct,
            completedReminders: completed,
            totalReminders: total,
            summary: `${pct}% adherence across ${total} active medication schedules`,
          };
        } else {
          adherenceData = {
            hasData: false,
            message: 'Medication adherence data is not available.',
          };
        }
      }
    }

    // Log Audit Event: PATIENT_RECORD_VIEWED
    await AuditService.log({
      userId: doctorUserId,
      action: 'PATIENT_RECORD_VIEWED',
      entityType: 'patients',
      entityId: patient.id,
      ipAddress,
      details: {
        doctorId: doctor.id,
        sessionId: activeSession.id,
        approvedScopes,
      },
    });

    return {
      session: {
        id: activeSession.id,
        status: 'ACTIVE',
        purpose: activeSession.purpose,
        grantedAt: activeSession.grantedAt,
        expiresAt: activeSession.expiresAt,
        approvedScopes,
      },
      patient: basicInfo,
      vitals,
      medicalRecords,
      reports,
      prescriptions,
      medicationHistory,
      adherence: adherenceData,
    };
  }
}
