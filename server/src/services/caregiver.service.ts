import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class CaregiverService {
  /**
   * Strict RBAC check: verify whether the authenticated user is authorized to access a patient's records.
   * Throws 403 Forbidden if unauthorized so all call sites enforce access strictly.
   */
  static async validateCaregiverAccess(userId: string, role: Role, patientId: string): Promise<boolean> {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN || role === Role.DOCTOR || role === Role.NURSE) {
      return true;
    }

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (patient && (!patientId || patient.id === patientId)) {
        return true;
      }
      throw new AppError('Forbidden: You do not have access to this patient record', 403);
    }

    if (role === Role.CAREGIVER) {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId },
        include: {
          patients: { select: { id: true } },
          patientLinks: true,
        },
      });
      if (!caregiver || !patientId) {
        throw new AppError('Forbidden: You do not have active authorized access to this patient', 403);
      }

      const link = caregiver.patientLinks.find((l) => l.patientId === patientId);
      if (link) {
        if (link.consentStatus === 'ACTIVE') return true;
        throw new AppError('Forbidden: Caregiver consent for this patient is not active', 403);
      }
      if (caregiver.patients.some((p) => p.id === patientId)) {
        return true;
      }
      throw new AppError('Forbidden: You do not have active authorized access to this patient', 403);
    }

    throw new AppError('Forbidden: Insufficient role to access patient records', 403);
  }

  private static async assertAuthorized(userId: string, role: Role, patientId: string) {
    await this.validateCaregiverAccess(userId, role, patientId);
  }

  /**
   * Get all wards / patients genuinely linked to the caregiver (no random auto-linking!)
   */
  static async getWards(userId: string, role: Role) {
    if (role === Role.PATIENT) {
      const pat = await prisma.patient.findUnique({
        where: { userId },
        include: {
          user: { select: { email: true, phoneNumber: true, abhaId: true } },
          vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
          patientMedications: { where: { status: 'active' } },
          caregiverTasks: { orderBy: { scheduledTime: 'asc' } },
          appointments: { orderBy: { appointmentDate: 'desc' }, take: 20 },
          careRequests: { orderBy: { createdAt: 'desc' }, take: 15 },
          allergies: true,
          conditions: true,
          emergencyContacts: true,
          caregivers: { select: { id: true, fullName: true, relationship: true } },
        },
      });
      return pat ? [pat] : [];
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId },
      include: {
        patientLinks: { select: { patientId: true, consentStatus: true } },
        patients: { select: { id: true } },
      },
    });

    if (!caregiver) return [];

    const inactiveLinkIds = new Set(
      caregiver.patientLinks.filter((l) => l.consentStatus !== 'ACTIVE').map((l) => l.patientId)
    );
    const activeLinkIds = caregiver.patientLinks
      .filter((l) => l.consentStatus === 'ACTIVE')
      .map((l) => l.patientId);

    const linkedIds = Array.from(
      new Set([
        ...caregiver.patients.map((p) => p.id).filter((id) => !inactiveLinkIds.has(id)),
        ...activeLinkIds,
      ])
    );

    if (linkedIds.length === 0) return [];

    return prisma.patient.findMany({
      where: { id: { in: linkedIds } },
      include: {
        user: { select: { email: true, phoneNumber: true, abhaId: true } },
        vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
        patientMedications: { where: { status: 'active' } },
        caregiverTasks: { orderBy: { scheduledTime: 'asc' } },
        appointments: { orderBy: { appointmentDate: 'desc' }, take: 20, include: { doctor: true } },
        careRequests: { orderBy: { createdAt: 'desc' }, take: 15, include: { nurse: true } },
        allergies: true,
        conditions: true,
        emergencyContacts: true,
        caregivers: { select: { id: true, fullName: true, relationship: true } },
        caregiverLinks: { where: { caregiverId: caregiver.id } },
      },
    });
  }

  /**
   * Get comprehensive authorized clinical records for a specific ward
   */
  static async getWardRecords(userId: string, role: Role, patientId: string) {
    await this.assertAuthorized(userId, role, patientId);

    const [medicalRecords, prescriptions, appointments, careRequests, vitals, wardNotes, sosAlerts, emergencyContacts] =
      await Promise.all([
        prisma.medicalRecord.findMany({ where: { patientId }, orderBy: { recordDate: 'desc' } }),
        prisma.prescription.findMany({
          where: { patientId },
          include: { items: true, doctor: { select: { id: true, fullName: true, speciality: true } } },
          orderBy: { issuedAt: 'desc' },
        }),
        prisma.appointment.findMany({
          where: { patientId },
          include: { doctor: { select: { id: true, fullName: true, speciality: true, hospital: true } } },
          orderBy: { appointmentDate: 'desc' },
        }),
        prisma.careRequest.findMany({
          where: { patientId },
          include: { nurse: { select: { id: true, fullName: true, department: true, designation: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.vital.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' }, take: 30 }),
        prisma.wardCareNote.findMany({
          where: { patientId },
          include: { caregiver: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.sosAlert.findMany({ where: { patientId }, orderBy: { triggeredAt: 'desc' }, take: 20 }),
        prisma.emergencyContact.findMany({ where: { patientId }, orderBy: { createdAt: 'asc' } }),
      ]);

    return {
      medicalRecords,
      prescriptions,
      appointments,
      careRequests,
      vitals,
      wardNotes,
      sosAlerts,
      emergencyContacts,
    };
  }

  /**
   * Get caregiver daily tasks
   */
  static async getTasks(userId: string, role: Role, patientIdQuery?: string) {
    const whereClause: any = {};

    if (role === Role.CAREGIVER) {
      const caregiver = await prisma.caregiver.findUnique({ where: { userId } });
      if (!caregiver) return [];
      whereClause.caregiverId = caregiver.id;
    } else if (role === Role.PATIENT) {
      const pat = await prisma.patient.findUnique({ where: { userId } });
      if (!pat) return [];
      whereClause.patientId = pat.id;
    }

    if (patientIdQuery) {
      await this.assertAuthorized(userId, role, patientIdQuery);
      whereClause.patientId = patientIdQuery;
    }

    return prisma.caregiverTask.findMany({
      where: whereClause,
      include: { patient: true },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  /**
   * Create caregiver task (requires authorized patientId)
   */
  static async createTask(userId: string, role: Role, data: any) {
    const caregiver = await prisma.caregiver.findUnique({ where: { userId } });
    if (!caregiver) {
      throw new AppError('Caregiver profile not found', 404);
    }

    const patientId = data.patientId;
    if (!patientId) throw new AppError('patientId is required', 400);
    await this.assertAuthorized(userId, role, patientId);

    return prisma.caregiverTask.create({
      data: {
        caregiverId: caregiver.id,
        patientId,
        title: data.title,
        category: data.category || 'Medication',
        scheduledTime: data.scheduledTime || '09:00 AM',
        status: data.status || 'Pending',
        priority: data.priority || 'Normal',
        notes: data.notes || '',
      },
      include: { patient: true },
    });
  }

  /**
   * Update task status (e.g. Completed, Skipped)
   */
  static async updateTask(userId: string, role: Role, id: string, data: { status?: string; notes?: string; title?: string; scheduledTime?: string }) {
    const existing = await prisma.caregiverTask.findUnique({ where: { id } });
    if (!existing) throw new AppError('Caregiver task not found', 404);
    await this.assertAuthorized(userId, role, existing.patientId);

    return prisma.caregiverTask.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.scheduledTime !== undefined && { scheduledTime: data.scheduledTime }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status === 'Completed' && { completedAt: new Date() }),
      },
      include: { patient: true },
    });
  }

  /**
   * Delete caregiver task
   */
  static async deleteTask(userId: string, role: Role, id: string) {
    const existing = await prisma.caregiverTask.findUnique({ where: { id } });
    if (!existing) throw new AppError('Caregiver task not found', 404);
    await this.assertAuthorized(userId, role, existing.patientId);
    await prisma.caregiverTask.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Log vital reading by caregiver (strictly authorized)
   */
  static async logVital(userId: string, role: Role, data: any) {
    const patientId = data.patientId;
    if (!patientId) throw new AppError('patientId is required', 400);
    await this.assertAuthorized(userId, role, patientId);

    return prisma.vital.create({
      data: {
        patientId,
        recordedById: userId,
        systolicBp: data.systolicBp ? parseInt(data.systolicBp, 10) : null,
        diastolicBp: data.diastolicBp ? parseInt(data.diastolicBp, 10) : null,
        heartRate: data.heartRate ? parseInt(data.heartRate, 10) : null,
        respiratoryRate: data.respiratoryRate ? parseInt(data.respiratoryRate, 10) : null,
        oxygenSaturation: data.oxygenSaturation ? parseFloat(data.oxygenSaturation) : null,
        temperature: data.temperature ? parseFloat(data.temperature) : null,
        bloodSugar: data.bloodSugar ? parseFloat(data.bloodSugar) : null,
        weightKg: data.weightKg ? parseFloat(data.weightKg) : null,
        notes: data.notes || 'Caregiver observation logged',
        recordedAt: new Date(),
      },
      include: { patient: true },
    });
  }

  /**
   * Ward Care Notes (persisted in WardCareNote)
   */
  static async getWardNotes(userId: string, role: Role, patientId: string) {
    await this.assertAuthorized(userId, role, patientId);
    return prisma.wardCareNote.findMany({
      where: { patientId },
      include: { caregiver: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createWardNote(userId: string, role: Role, data: { patientId: string; category?: string; content: string }) {
    if (!data.patientId || !data.content?.trim()) {
      throw new AppError('patientId and content are required', 400);
    }
    await this.assertAuthorized(userId, role, data.patientId);
    const caregiver = await prisma.caregiver.findUnique({ where: { userId } });
    if (!caregiver) throw new AppError('Caregiver profile not found', 404);

    return prisma.wardCareNote.create({
      data: {
        patientId: data.patientId,
        caregiverId: caregiver.id,
        category: data.category || 'General',
        content: data.content.trim(),
      },
      include: { caregiver: { select: { id: true, fullName: true } } },
    });
  }

  /**
   * Update ward geofence / last-known location
   */
  static async updatePatientLocation(
    userId: string,
    role: Role,
    data: { patientId: string; lastKnownLocation?: string; geofenceRadiusMeters?: number }
  ) {
    if (!data.patientId) throw new AppError('patientId is required', 400);
    await this.assertAuthorized(userId, role, data.patientId);
    return prisma.patient.update({
      where: { id: data.patientId },
      data: {
        ...(data.lastKnownLocation !== undefined ? { lastKnownLocation: data.lastKnownLocation, lastLocationUpdatedAt: new Date() } : {}),
        ...(data.geofenceRadiusMeters !== undefined ? { geofenceRadiusMeters: Number(data.geofenceRadiusMeters) } : {}),
      },
    });
  }

  /**
   * Get Care Circle members, persisted PatientCaregiverLink consent status/scopes, and audit logs
   */
  static async getCareCircle(userId: string, role: Role, patientId: string) {
    let targetPatientId = patientId;
    if (!targetPatientId && role === Role.PATIENT) {
      const own = await prisma.patient.findUnique({ where: { userId } });
      if (own) targetPatientId = own.id;
    }
    if (!targetPatientId && role === Role.CAREGIVER) {
      const wards = await this.getWards(userId, role);
      if (wards[0]) targetPatientId = wards[0].id;
    }
    if (!targetPatientId) throw new AppError('patientId is required', 400);

    await this.assertAuthorized(userId, role, targetPatientId);

    const patient = await prisma.patient.findUnique({
      where: { id: targetPatientId },
      include: {
        user: { select: { email: true, phoneNumber: true, abhaId: true } },
        caregivers: {
          include: { user: { select: { email: true, phoneNumber: true } } },
        },
        caregiverLinks: {
          include: {
            caregiver: { include: { user: { select: { email: true, phoneNumber: true } } } },
          },
        },
      },
    });

    if (!patient) throw new AppError('Patient profile not found', 404);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [{ entityId: targetPatientId }, { details: { contains: targetPatientId } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const linkMap = new Map(patient.caregiverLinks.map((l) => [l.caregiverId, l]));
    const colorBgs = [
      'from-teal-500 to-cyan-500',
      'from-blue-500 to-indigo-500',
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
    ];

    const allCaregiverMap = new Map<string, any>();
    patient.caregivers.forEach((cg) => allCaregiverMap.set(cg.id, cg));
    patient.caregiverLinks.forEach((l) => allCaregiverMap.set(l.caregiver.id, l.caregiver));

    const members = Array.from(allCaregiverMap.values()).map((cg, idx) => {
      const link = linkMap.get(cg.id);
      let scopes: any = { updates: true, appointments: true, notes: idx === 0, observations: true, meds: true };
      if (link?.consentScopesJson) {
        try {
          scopes = { ...scopes, ...JSON.parse(link.consentScopesJson) };
        } catch {}
      }
      const initials = cg.fullName
        ? cg.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'CG';

      return {
        id: cg.id,
        name: cg.fullName,
        initials,
        role: link?.relationship || cg.relationship || 'Caregiver',
        accessLevel: link?.accessLevel || (idx === 0 ? 'Full Access' : 'Care Access'),
        status: link?.consentStatus === 'REVOKED' ? 'Revoked' : 'Active',
        bg: colorBgs[idx % colorBgs.length],
        email: cg.user?.email || cg.phone || '',
        permissions: scopes,
      };
    });

    const anyRevoked = patient.caregiverLinks.length > 0 && patient.caregiverLinks.every((l) => l.consentStatus === 'REVOKED');
    const consentStatus = anyRevoked ? 'Revoked' : 'Active';

    const history = auditLogs.map((l) => ({
      id: l.id,
      date: new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      action: l.action.replace(/_/g, ' '),
      user: l.userId || 'System',
    }));

    const accessLogs = auditLogs
      .filter((l) => l.action.includes('VIEW') || l.action.includes('ACCESS') || l.action.includes('CONSENT') || l.action.includes('CARE_CIRCLE'))
      .map((l) => ({
        date: new Date(l.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit' }),
        user: 'Authorized Care Circle Member',
        action: l.action.replace(/_/g, ' '),
        permission: 'Health Records',
        status: 'Success',
      }));

    return {
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        abhaId: patient.user?.abhaId || '',
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
      },
      members,
      consentStatus,
      history,
      accessLogs,
    };
  }

  /**
   * Add a member to the Care Circle (bcrypt-hashed password + PatientCaregiverLink persistence)
   */
  static async addCareCircleMember(userId: string, role: Role, data: any) {
    const { patientId, name, relationship, email, phone, accessLevel, permissions } = data;
    if (!patientId || !name) {
      throw new AppError('Patient ID and member name are required', 400);
    }

    await this.assertAuthorized(userId, role, patientId);

    let targetUser = email ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } }) : null;
    let caregiverProfile: any = targetUser
      ? await prisma.caregiver.findUnique({ where: { userId: targetUser.id } })
      : null;

    if (!caregiverProfile) {
      const randomSecret = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomSecret, 10);
      const tempUser = targetUser || await prisma.user.create({
        data: {
          email: email ? String(email).toLowerCase().trim() : `caregiver_${Date.now()}_${crypto.randomInt(100, 999)}@dhr.local`,
          passwordHash: hashedPassword,
          role: Role.CAREGIVER,
          fullName: String(name).trim(),
          phoneNumber: phone || null,
        },
      });

      caregiverProfile = await prisma.caregiver.create({
        data: {
          userId: tempUser.id,
          fullName: String(name).trim(),
          relationship: relationship || 'Family Caregiver',
          phone: phone || tempUser.phoneNumber,
        },
      });
    }

    await prisma.$transaction([
      prisma.patient.update({
        where: { id: patientId },
        data: { caregivers: { connect: { id: caregiverProfile.id } } },
      }),
      prisma.patientCaregiverLink.upsert({
        where: { patientId_caregiverId: { patientId, caregiverId: caregiverProfile.id } },
        create: {
          patientId,
          caregiverId: caregiverProfile.id,
          relationship: relationship || 'Family Caregiver',
          accessLevel: accessLevel || 'Care Access',
          consentStatus: 'ACTIVE',
          consentScopesJson: permissions ? JSON.stringify(permissions) : null,
        },
        update: {
          relationship: relationship || 'Family Caregiver',
          accessLevel: accessLevel || 'Care Access',
          consentStatus: 'ACTIVE',
          ...(permissions ? { consentScopesJson: JSON.stringify(permissions) } : {}),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'CARE_CIRCLE_MEMBER_ADDED',
          entityType: 'CARE_CIRCLE',
          entityId: patientId,
          details: JSON.stringify({ addedMemberName: name, relationship }),
        },
      }),
    ]);

    return caregiverProfile;
  }

  /**
   * Remove a member from the Care Circle
   */
  static async removeCareCircleMember(userId: string, role: Role, patientId: string, targetCaregiverId: string) {
    if (!patientId || !targetCaregiverId) {
      throw new AppError('Patient ID and target caregiver ID are required', 400);
    }

    await this.assertAuthorized(userId, role, patientId);

    await prisma.$transaction([
      prisma.patient.update({
        where: { id: patientId },
        data: { caregivers: { disconnect: { id: targetCaregiverId } } },
      }),
      prisma.patientCaregiverLink.deleteMany({
        where: { patientId, caregiverId: targetCaregiverId },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'CARE_CIRCLE_MEMBER_REMOVED',
          entityType: 'CARE_CIRCLE',
          entityId: patientId,
          details: JSON.stringify({ removedCaregiverId: targetCaregiverId }),
        },
      }),
    ]);

    return { success: true, message: 'Care Circle member removed' };
  }

  /**
   * Revoke or Restore Patient Consent (persisted in PatientCaregiverLink + AuditLog)
   */
  static async toggleConsentStatus(
    userId: string,
    role: Role,
    patientId: string,
    status: 'Active' | 'Revoked',
    scopes?: Record<string, boolean>,
    caregiverId?: string
  ) {
    if (!patientId || !status) {
      throw new AppError('Patient ID and consent status are required', 400);
    }

    // Allow patient or currently linked caregiver/admin to toggle consent
    if (role === Role.PATIENT) {
      const own = await prisma.patient.findUnique({ where: { userId } });
      if (!own || own.id !== patientId) throw new AppError('Forbidden', 403);
    } else if (role === Role.CAREGIVER) {
      const cg = await prisma.caregiver.findUnique({ where: { userId }, include: { patients: true, patientLinks: true } });
      const linked = cg && (cg.patients.some((p) => p.id === patientId) || cg.patientLinks.some((l) => l.patientId === patientId));
      if (!linked) throw new AppError('Forbidden', 403);
    }

    const dbStatus = status === 'Revoked' ? 'REVOKED' : 'ACTIVE';
    const action = status === 'Active' ? 'PATIENT_CONSENT_RESTORED' : 'PATIENT_CONSENT_REVOKED';

    await prisma.patientCaregiverLink.updateMany({
      where: {
        patientId,
        ...(caregiverId ? { caregiverId } : {}),
      },
      data: {
        consentStatus: dbStatus,
        ...(scopes ? { consentScopesJson: JSON.stringify(scopes) } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'PATIENT_CONSENT',
        entityId: patientId,
        details: JSON.stringify({ updatedStatus: status, scopes: scopes || null, timestamp: new Date() }),
      },
    });

    return { success: true, consentStatus: status, message: `Patient consent status updated to ${status}` };
  }

  /**
   * Add / Link a Dependent Ward to the Caregiver
   */
  static async addDependent(
    userId: string,
    role: Role,
    data: { name: string; relationship?: string; dateOfBirth?: string; phone?: string; emergencyContact?: string }
  ) {
    const { name, relationship, dateOfBirth, phone, emergencyContact } = data;
    if (!name || name.trim().length === 0) {
      throw new AppError('Dependent name is required', 400);
    }

    let caregiver = await prisma.caregiver.findUnique({ where: { userId } });
    if (!caregiver) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('User profile not found', 404);
      caregiver = await prisma.caregiver.create({
        data: {
          userId,
          fullName: user.fullName || user.email.split('@')[0] || 'Caregiver',
          relationship: relationship || 'Primary Guardian',
          phone: user.phoneNumber || phone,
        },
      });
    }

    let existingPatient = null;
    if (phone && phone.trim()) {
      existingPatient = await prisma.patient.findFirst({
        where: {
          OR: [
            { user: { phoneNumber: phone.trim() } },
            { emergencyContactPhone: phone.trim() },
            { familyPhone: phone.trim() },
          ],
        },
      });
    }

    let targetPatientId = '';
    if (existingPatient) {
      // Do NOT auto-grant ACTIVE access to an existing patient without their explicit consent
      targetPatientId = existingPatient.id;
      await prisma.patientCaregiverLink.upsert({
        where: { patientId_caregiverId: { patientId: targetPatientId, caregiverId: caregiver.id } },
        create: {
          patientId: targetPatientId,
          caregiverId: caregiver.id,
          relationship: relationship || 'Family Guardian',
          accessLevel: 'View Only',
          isPrimary: false,
          consentStatus: 'PENDING',
        },
        update: {},
      });

      if (existingPatient.userId) {
        await prisma.notification.create({
          data: {
            userId: existingPatient.userId,
            type: 'CAREGIVER_LINK_REQUEST',
            title: 'Caregiver Link Request',
            message: `${caregiver.fullName} requested caregiver access to your profile. Please approve or decline in Family Connect.`,
            isRead: false,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'DEPENDENT_LINK_REQUESTED',
          entityType: 'PATIENT_CAREGIVER',
          entityId: targetPatientId,
          details: JSON.stringify({ patientName: name, relationship: relationship || 'Dependent', status: 'PENDING' }),
        },
      });

      return this.getWards(userId, role);
    } else {
      const uniqueTag = `${Date.now()}_${crypto.randomInt(100, 999)}`;
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const newUser = await prisma.user.create({
        data: {
          email: `dependent_${uniqueTag}@medicare.local`,
          passwordHash: hashedPassword,
          role: Role.PATIENT,
          fullName: name.trim(),
          phoneNumber: phone || null,
        },
      });

      const newPatient = await prisma.patient.create({
        data: {
          userId: newUser.id,
          fullName: name.trim(),
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          emergencyContactName: relationship ? `${relationship} Contact` : 'Emergency Contact',
          emergencyContactPhone: emergencyContact || phone || null,
          caregivers: { connect: { id: caregiver.id } },
        },
      });
      targetPatientId = newPatient.id;
    }

    await prisma.patientCaregiverLink.upsert({
      where: { patientId_caregiverId: { patientId: targetPatientId, caregiverId: caregiver.id } },
      create: {
        patientId: targetPatientId,
        caregiverId: caregiver.id,
        relationship: relationship || 'Dependent',
        accessLevel: 'Full Access',
        isPrimary: true,
        consentStatus: 'ACTIVE',
      },
      update: { consentStatus: 'ACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DEPENDENT_LINKED',
        entityType: 'PATIENT_CAREGIVER',
        entityId: targetPatientId,
        details: JSON.stringify({ patientName: name, relationship: relationship || 'Dependent' }),
      },
    });

    return this.getWards(userId, role);
  }

  /**
   * Remove / Unlink a Dependent Ward from the Caregiver
   */
  static async removeDependent(userId: string, role: Role, patientId: string) {
    if (!patientId) throw new AppError('Patient ID is required', 400);
    await this.assertAuthorized(userId, role, patientId);

    const caregiver = await prisma.caregiver.findUnique({ where: { userId } });
    if (!caregiver) throw new AppError('Caregiver profile not found', 404);

    await prisma.$transaction([
      prisma.caregiver.update({
        where: { id: caregiver.id },
        data: { patients: { disconnect: { id: patientId } } },
      }),
      prisma.patientCaregiverLink.deleteMany({
        where: { patientId, caregiverId: caregiver.id },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'DEPENDENT_UNLINKED',
          entityType: 'PATIENT_CAREGIVER',
          entityId: patientId,
          details: JSON.stringify({ unlinkedCaregiverId: caregiver.id, patientId }),
        },
      }),
    ]);

    return { success: true, message: 'Dependent successfully unlinked' };
  }
}
