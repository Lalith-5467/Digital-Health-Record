import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { emitInsuranceClaimEvent } from '../socket';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { CaregiverService } from './caregiver.service';

export class InsuranceService {
  private static async resolveProviderId(userId: string): Promise<string | null> {
    const provider = await prisma.insuranceProvider.findUnique({ where: { userId } });
    return provider?.id || null;
  }

  private static async assertPolicyAccess(
    userId: string,
    role: Role,
    policy: { patientId: string; providerId?: string | null },
    requireAdjudicator = false
  ) {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) return;
    if (role === Role.INSURANCE_PROVIDER) {
      const providerId = await this.resolveProviderId(userId);
      if (policy.providerId && providerId && policy.providerId !== providerId) {
        throw new AppError('Forbidden: Policy belongs to another insurance provider', 403);
      }
      return;
    }
    if (requireAdjudicator) {
      throw new AppError('Forbidden: Only Insurance Providers or Admins may perform this action', 403);
    }
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient || patient.id !== policy.patientId) {
        throw new AppError('Forbidden: Policy does not belong to your account', 403);
      }
      return;
    }
    if (role === Role.CAREGIVER) {
      await CaregiverService.validateCaregiverAccess(userId, role, policy.patientId);
      return;
    }
    throw new AppError('Forbidden: Insufficient role to access insurance policy data', 403);
  }

  /**
   * Get all insurance policies accessible to the user
   */
  static async getPolicies(userId: string, role: Role, search?: string) {
    const whereClause: any = {};

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);
      whereClause.patientId = patient.id;
    } else if (role === Role.CAREGIVER) {
      const wards = await CaregiverService.getWards(userId, role);
      const wardIds = wards.map((w: any) => w.id);
      if (wardIds.length === 0) return [];
      whereClause.patientId = { in: wardIds };
    } else if (role === Role.INSURANCE_PROVIDER) {
      const providerId = await this.resolveProviderId(userId);
      if (providerId) {
        whereClause.OR = [{ providerId }, { providerId: null }];
      }
    } else if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Insufficient role to view insurance policies', 403);
    }

    if (search) {
      const searchCond = [
        { policyNumber: { contains: search } },
        { policyName: { contains: search } },
        { insuranceId: { contains: search } },
      ];
      if (whereClause.OR) {
        whereClause.AND = [{ OR: whereClause.OR }, { OR: searchCond }];
        delete whereClause.OR;
      } else {
        whereClause.OR = searchCond;
      }
    }

    return prisma.insurancePolicy.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { user: { select: { email: true, phoneNumber: true, abhaId: true } } },
        },
        provider: true,
        claims: { orderBy: { createdAt: 'desc' } },
        preAuthorizations: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        familyMembers: { orderBy: { createdAt: 'asc' } },
        premiumPayments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get policy by id, insuranceId, or policyNumber (with tenant check)
   */
  static async getPolicyById(idOrInsuranceId: string, userId?: string, role?: Role) {
    const policy = await prisma.insurancePolicy.findFirst({
      where: {
        OR: [{ id: idOrInsuranceId }, { insuranceId: idOrInsuranceId }, { policyNumber: idOrInsuranceId }],
      },
      include: {
        patient: { include: { user: { select: { email: true, phoneNumber: true, abhaId: true } } } },
        provider: true,
        claims: { include: { settlements: true }, orderBy: { createdAt: 'desc' } },
        preAuthorizations: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        familyMembers: { orderBy: { createdAt: 'asc' } },
        premiumPayments: { orderBy: { paidAt: 'desc' } },
      },
    });

    if (!policy) throw new AppError('Insurance policy not found', 404);
    if (userId && role) {
      await this.assertPolicyAccess(userId, role, policy);
    }
    return policy;
  }

  /**
   * Create or link an insurance policy
   */
  static async createPolicy(userId: string, role: Role, data: any) {
    let patientId = data.patientId;
    let providerId = data.providerId || null;

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);
      patientId = patient.id;
    } else if (role === Role.CAREGIVER) {
      if (!patientId) throw new AppError('patientId is required', 400);
      await CaregiverService.validateCaregiverAccess(userId, role, patientId);
    } else if (role === Role.INSURANCE_PROVIDER) {
      providerId = (await this.resolveProviderId(userId)) || providerId;
    } else if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Your role cannot create insurance policies', 403);
    }

    if (!patientId) {
      if (data.patientEmail) {
        const u = await prisma.user.findUnique({ where: { email: String(data.patientEmail).toLowerCase() }, include: { patient: true } });
        if (u?.patient) patientId = u.patient.id;
      }
      if (!patientId) throw new AppError('patientId is required to create an insurance policy', 400);
    }

    const insuranceId = data.insuranceId || `INS-MC-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
    const policyNumber = data.policyNumber || `POL-DHR-${crypto.randomInt(100000, 999999)}`;
    const coverageAmount = Number(data.coverageAmount ?? 1000000);
    const usedCoverage = Number(data.usedCoverage ?? 0);
    const remainingCoverage = data.remainingCoverage !== undefined ? Number(data.remainingCoverage) : Math.max(0, coverageAmount - usedCoverage);

    return prisma.insurancePolicy.create({
      data: {
        insuranceId,
        patientId,
        providerId,
        policyNumber,
        policyName: data.policyName || 'Comprehensive Health Shield',
        policyStatus: data.policyStatus || 'Active',
        policyStartDate: data.policyStartDate ? new Date(data.policyStartDate) : new Date(),
        policyEndDate: data.policyEndDate ? new Date(data.policyEndDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        coverageAmount,
        usedCoverage,
        remainingCoverage,
        deductible: data.deductible !== undefined ? Number(data.deductible) : 0,
        coPayPercent: data.coPayPercent !== undefined ? Number(data.coPayPercent) : (data.copayPercentage !== undefined ? Number(data.copayPercentage) : 0),
        roomRentLimit: data.roomRentLimit || null,
        benefits: typeof data.benefits === 'object' ? JSON.stringify(data.benefits) : data.benefits || null,
      },
      include: { patient: true, provider: true },
    });
  }

  static async updatePolicy(userId: string, role: Role, id: string, data: any) {
    const existing = await prisma.insurancePolicy.findFirst({ where: { OR: [{ id }, { policyNumber: id }] } });
    if (!existing) throw new AppError('Insurance policy not found', 404);
    await this.assertPolicyAccess(userId, role, existing);

    const coverageAmount = data.coverageAmount !== undefined ? Number(data.coverageAmount) : Number(existing.coverageAmount);
    const usedCoverage = data.usedCoverage !== undefined ? Number(data.usedCoverage) : Number(existing.usedCoverage);
    const remainingCoverage =
      data.remainingCoverage !== undefined ? Number(data.remainingCoverage) : Math.max(0, coverageAmount - usedCoverage);

    return prisma.insurancePolicy.update({
      where: { id: existing.id },
      data: {
        ...(data.policyName !== undefined ? { policyName: data.policyName } : {}),
        ...(data.policyStatus !== undefined ? { policyStatus: data.policyStatus } : {}),
        ...(data.policyStartDate ? { policyStartDate: new Date(data.policyStartDate) } : {}),
        ...(data.policyEndDate ? { policyEndDate: new Date(data.policyEndDate) } : {}),
        coverageAmount,
        usedCoverage,
        remainingCoverage,
        ...(data.deductible !== undefined ? { deductible: Number(data.deductible) } : {}),
        ...(data.coPayPercent !== undefined ? { coPayPercent: Number(data.coPayPercent) } : data.copayPercentage !== undefined ? { coPayPercent: Number(data.copayPercentage) } : {}),
        ...(data.roomRentLimit !== undefined ? { roomRentLimit: data.roomRentLimit } : {}),
        ...(data.benefits !== undefined
          ? { benefits: typeof data.benefits === 'object' ? JSON.stringify(data.benefits) : data.benefits }
          : {}),
      },
      include: { patient: true, provider: true },
    });
  }

  static async deletePolicy(userId: string, role: Role, id: string) {
    const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
    if (!existing) throw new AppError('Insurance policy not found', 404);
    await this.assertPolicyAccess(userId, role, existing);
    await prisma.insurancePolicy.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Get all claims (tenant-scoped)
   */
  static async getClaims(userId: string, role: Role, status?: string) {
    const whereClause: any = {};

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);
      whereClause.patientId = patient.id;
    } else if (role === Role.CAREGIVER) {
      const wards = await CaregiverService.getWards(userId, role);
      const wardIds = wards.map((w: any) => w.id);
      if (wardIds.length === 0) return [];
      whereClause.patientId = { in: wardIds };
    } else if (role === Role.INSURANCE_PROVIDER) {
      const providerId = await this.resolveProviderId(userId);
      if (providerId) {
        whereClause.policy = { OR: [{ providerId }, { providerId: null }] };
      }
    } else if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Insufficient role to view insurance claims', 403);
    }

    if (status && status !== 'All') {
      whereClause.status = status;
    }

    return prisma.insuranceClaim.findMany({
      where: whereClause,
      include: {
        policy: true,
        patient: { include: { user: { select: { email: true, phoneNumber: true, abhaId: true } } } },
        settlements: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new claim
   */
  static async createClaim(userId: string, role: Role, data: any) {
    let patientId = data.patientId;
    let policyId = data.policyId;

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);
      patientId = patient.id;
    } else if (role === Role.CAREGIVER) {
      if (!patientId) throw new AppError('patientId is required', 400);
      await CaregiverService.validateCaregiverAccess(userId, role, patientId);
    } else if (role !== Role.INSURANCE_PROVIDER && role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Your role cannot submit insurance claims', 403);
    }

    if (policyId) {
      const targetPolicy = await prisma.insurancePolicy.findUnique({ where: { id: policyId } });
      if (!targetPolicy) throw new AppError('Insurance policy not found', 404);
      await this.assertPolicyAccess(userId, role, targetPolicy);
      patientId = targetPolicy.patientId;
    }

    if (!policyId && patientId) {
      const policy = await prisma.insurancePolicy.findFirst({
        where: data.insuranceId ? { insuranceId: data.insuranceId, patientId } : { patientId },
      });
      if (policy) {
        policyId = policy.id;
      } else {
        const insuranceId = data.insuranceId || `INS-MC-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
        const policyNumber = data.policyNumber || `POL-DHR-${crypto.randomInt(100000, 999999)}`;
        const newPolicy = await prisma.insurancePolicy.create({
          data: {
            insuranceId,
            patientId,
            policyNumber,
            policyName: data.policyName || 'Comprehensive Health Policy',
            policyStatus: 'Active',
            policyStartDate: new Date(),
            policyEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            coverageAmount: 1000000.0,
            usedCoverage: 0.0,
            remainingCoverage: 1000000.0,
          },
        });
        policyId = newPolicy.id;
      }
    }

    if (!policyId || !patientId) {
      throw new AppError('Policy and Patient references are required to create a claim', 400);
    }

    const claimId = data.claimId || `CLM-${crypto.randomInt(1000, 9999)}-${new Date().getFullYear()}`;
    const existingClaim = await prisma.insuranceClaim.findUnique({
      where: { claimId },
      include: { policy: true, patient: { include: { user: { select: { email: true, phoneNumber: true } } } } },
    });
    if (existingClaim) return existingClaim;

    const defaultTimeline = [
      {
        id: 't-1',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Claim Submitted Online',
        role: role === Role.PATIENT ? 'Patient' : 'Insurance Desk',
        status: 'Completed',
      },
      {
        id: 't-2',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Claim Under Review by Insurance Desk',
        role: 'TPA Medical Officer',
        status: 'Current',
      },
    ];

    const isAdjudicator = role === Role.INSURANCE_PROVIDER || role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const createdClaim = await prisma.insuranceClaim.create({
      data: {
        claimId,
        policyId,
        patientId,
        hospital: data.hospital || 'Network Hospital',
        treatment: data.treatment || 'Medical Treatment',
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
        dischargeDate: data.dischargeDate ? new Date(data.dischargeDate) : new Date(),
        submittedAmount: Number(data.submittedAmount || 0),
        approvedAmount: isAdjudicator ? Number(data.approvedAmount || 0) : 0,
        patientContribution: Number(data.patientContribution || 0),
        status: isAdjudicator ? (data.status || 'Under Review') : 'Under Review',
        documents: typeof data.documents === 'object' ? JSON.stringify(data.documents) : data.documents || null,
        timeline: JSON.stringify(data.timeline || defaultTimeline),
      },
      include: {
        policy: true,
        patient: { include: { user: { select: { email: true, phoneNumber: true } } } },
      },
    });

    try {
      emitInsuranceClaimEvent('insurance:claim-created', createdClaim);
      const insuranceUsers = await prisma.user.findMany({
        where: { role: Role.INSURANCE_PROVIDER, isActive: true },
        select: { id: true },
        take: 10,
      });
      for (const insUser of insuranceUsers) {
        await NotificationService.createNotification({
          userId: insUser.id,
          title: `Incoming Claim: ${createdClaim.claimId}`,
          message: `${createdClaim.patient?.fullName || 'Patient'} submitted a claim for ₹${Number(createdClaim.submittedAmount).toLocaleString('en-IN')} at ${createdClaim.hospital}.`,
          type: 'ALERT',
          category: 'Insurance Pre-Auth',
          relatedModule: 'insurance',
        });
      }
    } catch {}

    return createdClaim;
  }

  /**
   * Atomic claim adjudication: updates claim, deducts policy coverage, and auto-creates ClaimSettlement
   */
  static async updateClaimStatus(
    claimId: string,
    status: string,
    approvedAmount?: number,
    reason?: string,
    actorUserId?: string,
    actorRole?: Role
  ) {
    const claim = await prisma.insuranceClaim.findFirst({
      where: { OR: [{ id: claimId }, { claimId }] },
      include: { policy: true, settlements: true },
    });

    if (!claim) throw new AppError('Claim not found', 404);
    if (actorUserId && actorRole) {
      await this.assertPolicyAccess(actorUserId, actorRole, claim.policy, true);
    }

    let timeline: any[] = [];
    try {
      timeline = claim.timeline ? JSON.parse(claim.timeline) : [];
    } catch {
      timeline = [];
    }

    timeline.push({
      id: `t-${timeline.length + 1}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: reason || `Claim status updated to ${status}`,
      role: 'Insurance Approver',
      status: 'Completed',
    });

    const isApproved = status === 'Approved' || status === 'Partially Approved';
    const isSettled = status === 'Settled';
    const isRejected = status === 'Rejected';

    const submitted = Number(claim.submittedAmount);
    const effectiveApproved =
      approvedAmount !== undefined
        ? Number(approvedAmount)
        : isApproved || isSettled
        ? Number(claim.approvedAmount) > 0
          ? Number(claim.approvedAmount)
          : submitted
        : 0;

    const prevApprovedAlreadyDeducted =
      ['Approved', 'Partially Approved', 'Settled'].includes(claim.status) ? Number(claim.approvedAmount) : 0;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedClaim = await tx.insuranceClaim.update({
        where: { id: claim.id },
        data: {
          status,
          approvedAmount: isRejected ? 0 : effectiveApproved,
          patientContribution: isRejected ? submitted : Math.max(0, submitted - effectiveApproved),
          timeline: JSON.stringify(timeline),
        },
        include: {
          policy: true,
          patient: { include: { user: { select: { id: true, email: true, phoneNumber: true } } } },
          settlements: true,
        },
      });

      // Atomic policy coverage adjustment when approving/settling
      if ((isApproved || isSettled) && effectiveApproved > prevApprovedAlreadyDeducted) {
        const delta = effectiveApproved - prevApprovedAlreadyDeducted;
        const newUsed = Number(claim.policy.usedCoverage) + delta;
        const newRemaining = Math.max(0, Number(claim.policy.coverageAmount) - newUsed);
        await tx.insurancePolicy.update({
          where: { id: claim.policyId },
          data: {
            usedCoverage: newUsed,
            remainingCoverage: newRemaining,
          },
        });
      }

      // Auto-create settlement record if approved/settled and no settlement exists yet
      if ((isApproved || isSettled) && effectiveApproved > 0 && claim.settlements.length === 0) {
        await tx.claimSettlement.create({
          data: {
            settlementId: `STL-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`,
            claimId: claim.id,
            paymentMode: 'NEFT / Direct Bank Transfer',
            paymentType: 'Cashless',
            referenceNumber: `UTR${Date.now().toString().slice(-8)}`,
            paidAmount: effectiveApproved,
            hospitalDeduction: Math.max(0, submitted - effectiveApproved),
            status: isSettled ? 'Processed' : 'In Transit',
            notes: reason || `Auto-generated settlement for claim ${claim.claimId}`,
          },
        });
      } else if (isSettled && claim.settlements.length > 0) {
        await tx.claimSettlement.updateMany({
          where: { claimId: claim.id },
          data: { status: 'Processed', settlementDate: new Date() },
        });
      }

      return tx.insuranceClaim.findUnique({
        where: { id: updatedClaim.id },
        include: {
          policy: true,
          patient: { include: { user: { select: { id: true, email: true, phoneNumber: true } } } },
          settlements: true,
        },
      });
    });

    if (actorUserId && updated) {
      await AuditService.log({
        userId: actorUserId,
        action: `INSURANCE_CLAIM_${status.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'InsuranceClaim',
        entityId: updated.id,
        details: { claimId: updated.claimId, approvedAmount: effectiveApproved, reason },
      });
    }

    if (updated?.patient?.userId || updated?.patient?.user?.id) {
      const patientUserId = updated.patient.userId || updated.patient.user!.id;
      const notifTitle = isApproved
        ? `Claim Approved: ${updated.claimId}`
        : isRejected
        ? `Claim Declined: ${updated.claimId}`
        : isSettled
        ? `Claim Settled: ${updated.claimId}`
        : `Claim Update: ${updated.claimId}`;
      const notifMsg = isApproved
        ? `Your claim for ₹${effectiveApproved.toLocaleString('en-IN')} at ${updated.hospital} has been approved.`
        : isRejected
        ? `Your claim at ${updated.hospital} was declined. Reason: ${reason || 'Policy verification check'}.`
        : isSettled
        ? `Settlement completed for ₹${effectiveApproved.toLocaleString('en-IN')}.`
        : `Your claim status is now ${status}.`;

      try {
        await NotificationService.createNotification({
          userId: patientUserId,
          title: notifTitle,
          message: notifMsg,
          type: isApproved || isSettled ? 'SUCCESS' : isRejected ? 'ALERT' : 'INFO',
          category: 'Insurance Pre-Auth',
          relatedModule: 'insurance',
        });
      } catch {}
    }

    try {
      emitInsuranceClaimEvent('insurance:claim-updated', updated);
    } catch {}

    return updated;
  }

  // ==========================================
  // PRE-AUTHORIZATIONS
  // ==========================================
  static async getPreAuthorizations(userId: string, role: Role) {
    const whereClause: any = {};
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) return [];
      whereClause.policy = { patientId: patient.id };
    } else if (role === Role.CAREGIVER) {
      const wards = await CaregiverService.getWards(userId, role);
      const wardIds = wards.map((w: any) => w.id);
      if (wardIds.length === 0) return [];
      whereClause.policy = { patientId: { in: wardIds } };
    } else if (role === Role.INSURANCE_PROVIDER) {
      const providerId = await this.resolveProviderId(userId);
      if (providerId) {
        whereClause.policy = { OR: [{ providerId }, { providerId: null }] };
      }
    } else if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Insufficient role to view pre-authorizations', 403);
    }

    return prisma.preAuthorization.findMany({
      where: whereClause,
      include: { policy: { include: { patient: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createPreAuthorization(userId: string, role: Role, data: any) {
    let policyId = data.policyId;
    if (!policyId) {
      const policies = await this.getPolicies(userId, role);
      if (!policies[0]) throw new AppError('Active insurance policy required for pre-authorization', 400);
      policyId = policies[0].id;
    }
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: policyId } });
    if (!policy) throw new AppError('Policy not found', 404);
    await this.assertPolicyAccess(userId, role, policy);

    const preAuthId = data.preAuthId || `PA-${crypto.randomInt(1000, 9999)}-${new Date().getFullYear()}`;
    return prisma.preAuthorization.create({
      data: {
        preAuthId,
        policyId,
        hospitalName: data.hospitalName || 'Network Hospital',
        doctorName: data.doctorName || 'Attending Physician',
        procedure: data.procedure || 'Cashless Admission',
        requestType: data.requestType || 'Planned',
        treatmentType: data.treatmentType || null,
        department: data.department || null,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
        expectedDischargeDate: data.expectedDischargeDate ? new Date(data.expectedDischargeDate) : null,
        diagnosis: data.diagnosis || null,
        estimatedCost: Number(data.estimatedCost ?? data.requestedAmount ?? 0),
        requestedAmount: Number(data.requestedAmount ?? data.estimatedCost ?? 0),
        eligibleCoverage: data.eligibleCoverage !== undefined ? Number(data.eligibleCoverage) : Number(policy.remainingCoverage),
        patientContribution: data.patientContribution !== undefined ? Number(data.patientContribution) : 0,
        status: 'Pending',
        documentsJson: data.documents ? JSON.stringify(data.documents) : null,
      },
      include: { policy: { include: { patient: true } } },
    });
  }

  static async updatePreAuthorizationStatus(
    userId: string,
    role: Role,
    id: string,
    data: { status: string; responseNotes?: string; hospitalQueryNotes?: string; assessmentChecklist?: any; eligibleCoverage?: number; patientContribution?: number }
  ) {
    const existing = await prisma.preAuthorization.findFirst({
      where: { OR: [{ id }, { preAuthId: id }] },
      include: { policy: { include: { patient: true } } },
    });
    if (!existing) throw new AppError('Pre-authorization not found', 404);
    await this.assertPolicyAccess(userId, role, existing.policy, true);

    const updated = await prisma.preAuthorization.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        ...(data.responseNotes !== undefined ? { responseNotes: data.responseNotes } : {}),
        ...(data.hospitalQueryNotes !== undefined ? { hospitalQueryNotes: data.hospitalQueryNotes, hospitalQueryStatus: 'Sent' } : {}),
        ...(data.assessmentChecklist !== undefined ? { assessmentChecklistJson: JSON.stringify(data.assessmentChecklist) } : {}),
        ...(data.eligibleCoverage !== undefined ? { eligibleCoverage: Number(data.eligibleCoverage) } : {}),
        ...(data.patientContribution !== undefined ? { patientContribution: Number(data.patientContribution) } : {}),
        actionDate: new Date(),
      },
      include: { policy: { include: { patient: true } } },
    });

    await AuditService.log({
      userId,
      action: `PREAUTH_${data.status.toUpperCase().replace(/\s+/g, '_')}`,
      entityType: 'PreAuthorization',
      entityId: updated.id,
      details: { preAuthId: updated.preAuthId, status: updated.status },
    });

    return updated;
  }

  // ==========================================
  // SETTLEMENTS
  // ==========================================
  static async getSettlements(userId: string, role: Role) {
    const whereClause: any = {};
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) return [];
      whereClause.claim = { patientId: patient.id };
    } else if (role === Role.CAREGIVER) {
      const wards = await CaregiverService.getWards(userId, role);
      const wardIds = wards.map((w: any) => w.id);
      if (wardIds.length === 0) return [];
      whereClause.claim = { patientId: { in: wardIds } };
    } else if (role === Role.INSURANCE_PROVIDER) {
      const providerId = await this.resolveProviderId(userId);
      if (providerId) {
        whereClause.claim = { policy: { OR: [{ providerId }, { providerId: null }] } };
      }
    } else if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Forbidden: Insufficient role to view settlements', 403);
    }

    return prisma.claimSettlement.findMany({
      where: whereClause,
      include: { claim: { include: { policy: true, patient: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createSettlement(userId: string, role: Role, data: any) {
    const claim = await prisma.insuranceClaim.findFirst({
      where: { OR: [{ id: data.claimId }, { claimId: data.claimId }] },
      include: { policy: true },
    });
    if (!claim) throw new AppError('Claim not found', 404);
    await this.assertPolicyAccess(userId, role, claim.policy, true);

    return prisma.claimSettlement.create({
      data: {
        settlementId: data.settlementId || `STL-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`,
        claimId: claim.id,
        paymentMode: data.paymentMode || 'NEFT / Direct Bank Transfer',
        paymentType: data.paymentType || 'Cashless',
        referenceNumber: data.referenceNumber || `UTR${Date.now().toString().slice(-8)}`,
        bankRef: data.bankRef || null,
        paidAmount: Number(data.paidAmount ?? claim.approvedAmount ?? 0),
        hospitalDeduction: data.hospitalDeduction !== undefined ? Number(data.hospitalDeduction) : 0,
        status: data.status || 'Processed',
        notes: data.notes || null,
      },
      include: { claim: { include: { policy: true, patient: true } } },
    });
  }

  static async updateSettlementStatus(userId: string, role: Role, id: string, data: { status: string; referenceNumber?: string; notes?: string }) {
    const existing = await prisma.claimSettlement.findFirst({
      where: { OR: [{ id }, { settlementId: id }] },
      include: { claim: { include: { policy: true } } },
    });
    if (!existing) throw new AppError('Settlement not found', 404);
    await this.assertPolicyAccess(userId, role, existing.claim.policy, true);

    return prisma.claimSettlement.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        ...(data.referenceNumber ? { referenceNumber: data.referenceNumber } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        settlementDate: new Date(),
      },
      include: { claim: { include: { policy: true, patient: true } } },
    });
  }

  // ==========================================
  // POLICY DOCUMENTS, FAMILY MEMBERS, PREMIUM PAYMENTS
  // ==========================================
  static async getDocuments(userId: string, role: Role, policyId?: string) {
    const policies = await this.getPolicies(userId, role);
    const allowedIds = policies.map((p) => p.id);
    if (policyId && !allowedIds.includes(policyId)) throw new AppError('Forbidden', 403);
    return prisma.insuranceDocument.findMany({
      where: { policyId: policyId ? policyId : { in: allowedIds } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async addDocument(userId: string, role: Role, data: { policyId: string; title: string; docType?: string; fileUrl?: string; fileSize?: string }) {
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: data.policyId } });
    if (!policy) throw new AppError('Policy not found', 404);
    await this.assertPolicyAccess(userId, role, policy);
    return prisma.insuranceDocument.create({
      data: {
        policyId: policy.id,
        title: data.title,
        docType: data.docType || 'Policy Copy',
        fileUrl: data.fileUrl || null,
        fileSize: data.fileSize || null,
        status: 'Verified',
      },
    });
  }

  static async updateDocumentStatus(userId: string, role: Role, id: string, status: string) {
    const doc = await prisma.insuranceDocument.findUnique({ where: { id }, include: { policy: true } });
    if (!doc) throw new AppError('Document not found', 404);
    await this.assertPolicyAccess(userId, role, doc.policy, true);
    return prisma.insuranceDocument.update({
      where: { id },
      data: { status: status || 'Verified' },
    });
  }

  static async deleteDocument(userId: string, role: Role, id: string) {
    const doc = await prisma.insuranceDocument.findUnique({ where: { id }, include: { policy: true } });
    if (!doc) throw new AppError('Document not found', 404);
    await this.assertPolicyAccess(userId, role, doc.policy);
    await prisma.insuranceDocument.delete({ where: { id } });
    return { deleted: true };
  }

  static async getFamilyMembers(userId: string, role: Role, policyId?: string) {
    const policies = await this.getPolicies(userId, role);
    const allowedIds = policies.map((p) => p.id);
    if (policyId && !allowedIds.includes(policyId)) throw new AppError('Forbidden', 403);
    return prisma.insuranceFamilyMember.findMany({
      where: { policyId: policyId ? policyId : { in: allowedIds } },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async addFamilyMember(userId: string, role: Role, data: { policyId: string; name: string; relationship: string; age?: number; memberId?: string }) {
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: data.policyId } });
    if (!policy) throw new AppError('Policy not found', 404);
    await this.assertPolicyAccess(userId, role, policy);
    return prisma.insuranceFamilyMember.create({
      data: {
        policyId: policy.id,
        name: data.name,
        relationship: data.relationship,
        age: data.age !== undefined ? Number(data.age) : null,
        memberId: data.memberId || `MEM-${crypto.randomInt(1000, 9999)}`,
      },
    });
  }

  static async deleteFamilyMember(userId: string, role: Role, id: string) {
    const member = await prisma.insuranceFamilyMember.findUnique({ where: { id }, include: { policy: true } });
    if (!member) throw new AppError('Family member not found', 404);
    await this.assertPolicyAccess(userId, role, member.policy);
    await prisma.insuranceFamilyMember.delete({ where: { id } });
    return { deleted: true };
  }

  static async getPremiumPayments(userId: string, role: Role, policyId?: string) {
    const policies = await this.getPolicies(userId, role);
    const allowedIds = policies.map((p) => p.id);
    if (policyId && !allowedIds.includes(policyId)) throw new AppError('Forbidden', 403);
    return prisma.insurancePremiumPayment.findMany({
      where: { policyId: policyId ? policyId : { in: allowedIds } },
      orderBy: { paidAt: 'desc' },
    });
  }

  static async recordPremiumPayment(userId: string, role: Role, data: { policyId: string; amount: number; paymentMethod?: string; transactionRef?: string }) {
    const policy = await prisma.insurancePolicy.findUnique({ where: { id: data.policyId } });
    if (!policy) throw new AppError('Policy not found', 404);
    await this.assertPolicyAccess(userId, role, policy);

    return prisma.insurancePremiumPayment.create({
      data: {
        policyId: policy.id,
        amount: Number(data.amount),
        paymentMethod: data.paymentMethod || 'UPI',
        transactionRef: data.transactionRef || `PRM-${Date.now().toString().slice(-8)}`,
        status: 'Paid',
      },
    });
  }

  // ==========================================
  // AGENT PAYOUTS, TPA SETTINGS & NETWORK HOSPITALS
  // ==========================================
  static async getAgentPayouts(userId: string, role: Role) {
    const providerId = role === Role.INSURANCE_PROVIDER ? await this.resolveProviderId(userId) : null;
    return prisma.insuranceAgentPayout.findMany({
      where: providerId ? { providerId } : {},
      orderBy: { paidAt: 'desc' },
    });
  }

  static async createAgentPayout(userId: string, data: { agentName: string; hospitalName?: string; amount: number; status?: string; referenceNo?: string }) {
    const providerId = await this.resolveProviderId(userId);
    if (!providerId) throw new AppError('Insurance provider profile not found', 404);
    return prisma.insuranceAgentPayout.create({
      data: {
        providerId,
        agentName: data.agentName,
        hospitalName: data.hospitalName || null,
        amount: Number(data.amount),
        status: data.status || 'Processed',
        referenceNo: data.referenceNo || `PAY-${Date.now().toString().slice(-8)}`,
      },
    });
  }

  static async getTpaSettings(userId: string) {
    const providerId = await this.resolveProviderId(userId);
    if (!providerId) throw new AppError('Insurance provider profile not found', 404);
    return prisma.insuranceTpaSetting.upsert({
      where: { providerId },
      create: { providerId },
      update: {},
    });
  }

  static async updateTpaSettings(userId: string, data: any) {
    const providerId = await this.resolveProviderId(userId);
    if (!providerId) throw new AppError('Insurance provider profile not found', 404);
    return prisma.insuranceTpaSetting.upsert({
      where: { providerId },
      create: {
        providerId,
        autoApprovalThreshold: data.autoApprovalThreshold !== undefined ? Number(data.autoApprovalThreshold) : 25000,
        slaHours: data.slaHours !== undefined ? Number(data.slaHours) : 24,
        workflowPrefsJson: data.workflowPrefs ? JSON.stringify(data.workflowPrefs) : null,
        notificationPrefsJson: data.notificationPrefs ? JSON.stringify(data.notificationPrefs) : null,
        securityPrefsJson: data.securityPrefs ? JSON.stringify(data.securityPrefs) : null,
      },
      update: {
        ...(data.autoApprovalThreshold !== undefined ? { autoApprovalThreshold: Number(data.autoApprovalThreshold) } : {}),
        ...(data.slaHours !== undefined ? { slaHours: Number(data.slaHours) } : {}),
        ...(data.workflowPrefs !== undefined ? { workflowPrefsJson: JSON.stringify(data.workflowPrefs) } : {}),
        ...(data.notificationPrefs !== undefined ? { notificationPrefsJson: JSON.stringify(data.notificationPrefs) } : {}),
        ...(data.securityPrefs !== undefined ? { securityPrefsJson: JSON.stringify(data.securityPrefs) } : {}),
      },
    });
  }

  static async getNetworkHospitals(search?: string) {
    return prisma.hospital.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { city: { contains: search } },
              { state: { contains: search } },
              { address: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }
}
