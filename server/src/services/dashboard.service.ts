import { prisma } from '../config/prisma';
import { Role, OrderStatus, AppointmentStatus, PrescriptionStatus, ReminderStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class DashboardService {
  /**
   * Get calculated real-time statistics and summary metrics for current user / role
   */
  static async getStats(userId: string, role: Role) {
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);

      const [
        totalRecords,
        activePrescriptions,
        upcomingAppointments,
        activeReminders,
        activeOrders,
        latestVitals,
        nextAppointment,
        activeMedications,
        recentRecords,
        primaryPolicy,
        familyMembersCount,
        nearbyHospitalsCount,
        activeGoalsCount,
        latestCheckup,
        recentActivity,
      ] = await Promise.all([
        prisma.medicalRecord.count({ where: { patientId: patient.id } }),
        prisma.prescription.count({
          where: {
            patientId: patient.id,
            status: { in: [PrescriptionStatus.CONFIRMED, PrescriptionStatus.ACTIVE, PrescriptionStatus.PHARMACY_ORDER_CREATED] },
          },
        }),
        prisma.appointment.count({
          where: {
            patientId: patient.id,
            status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
            appointmentDate: { gte: new Date() },
          },
        }),
        prisma.reminder.count({
          where: {
            patientId: patient.id,
            status: ReminderStatus.ACTIVE,
          },
        }),
        prisma.pharmacyOrder.count({
          where: {
            patientId: patient.id,
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.DECLINED] },
          },
        }),
        prisma.vital.findFirst({
          where: { patientId: patient.id },
          orderBy: { recordedAt: 'desc' },
        }),
        prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
            appointmentDate: { gte: new Date() },
          },
          orderBy: { appointmentDate: 'asc' },
          include: { doctor: { select: { id: true, fullName: true, speciality: true, hospital: true } } },
        }),
        prisma.patientMedication.findMany({
          where: { patientId: patient.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.medicalRecord.findMany({
          where: { patientId: patient.id },
          orderBy: { recordDate: 'desc' },
          take: 5,
        }),
        prisma.insurancePolicy.findFirst({
          where: { patientId: patient.id, policyStatus: 'Active' },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.familyConnection.count({
          where: { patientId: patient.id, status: 'CONNECTED' },
        }),
        prisma.hospital.count({ where: { status: 'ACTIVE' } }),
        prisma.healthGoal.count({ where: { patientId: patient.id, isPaused: false } }),
        prisma.healthCheckup.findFirst({
          where: { patientId: patient.id, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        }),
        prisma.auditLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

      return {
        role: Role.PATIENT,
        patientId: patient.id,
        patientName: patient.fullName,
        bloodGroup: patient.bloodGroup,
        totalRecords,
        activePrescriptions,
        upcomingAppointments,
        activeReminders,
        activeOrders,
        latestVitals: latestVitals || null,
        nextAppointment,
        activeMedications,
        recentRecords,
        insuranceSummary: primaryPolicy,
        familyMembersCount,
        nearbyHospitalsCount,
        activeGoalsCount,
        latestCheckup,
        recentActivity,
      };
    }

    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) throw new AppError('Doctor profile not found', 404);

      const [
        distinctApptPatients,
        todayAppointments,
        pendingAppointments,
        prescriptionsIssued,
      ] = await Promise.all([
        prisma.appointment.findMany({
          where: { doctorId: doctor.id },
          distinct: ['patientId'],
          select: { patientId: true },
        }),
        prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            appointmentDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
        prisma.appointment.count({
          where: { doctorId: doctor.id, status: AppointmentStatus.PENDING },
        }),
        prisma.prescription.count({
          where: { doctorId: doctor.id },
        }),
      ]);
      const totalPatients = distinctApptPatients.length;

      return {
        role: Role.DOCTOR,
        doctorName: doctor.fullName,
        speciality: doctor.speciality,
        totalPatients,
        todayAppointments,
        pendingAppointments,
        prescriptionsIssued,
      };
    }

    if (role === Role.PHARMACIST) {
      const pharmacist = await prisma.pharmacist.findUnique({ where: { userId } });
      const pharmacyId = pharmacist?.pharmacyId;

      const [
        pendingOrders,
        preparingOrders,
        readyOrders,
        totalOrders,
        medicinesCount,
      ] = await Promise.all([
        prisma.pharmacyOrder.count({
          where: { ...(pharmacyId && { pharmacyId }), status: OrderStatus.PENDING },
        }),
        prisma.pharmacyOrder.count({
          where: { ...(pharmacyId && { pharmacyId }), status: OrderStatus.PREPARING },
        }),
        prisma.pharmacyOrder.count({
          where: { ...(pharmacyId && { pharmacyId }), status: { in: [OrderStatus.READY, OrderStatus.READY_FOR_PICKUP] } },
        }),
        prisma.pharmacyOrder.count({
          where: { ...(pharmacyId && { pharmacyId }) },
        }),
        prisma.medicine.count(),
      ]);

      return {
        role: Role.PHARMACIST,
        pharmacistName: pharmacist?.fullName,
        pharmacyName: pharmacist?.pharmacyName,
        pendingOrders,
        preparingOrders,
        readyOrders,
        totalOrders,
        medicinesCount,
      };
    }

    if (role === Role.NURSE) {
      const nurse = await prisma.nurse.findUnique({ where: { userId } });
      const [totalVisits, pendingVisits, nursePatients] = await Promise.all([
        prisma.careRequest.count({ where: { ...(nurse && { nurseId: nurse.id }) } }),
        prisma.careRequest.count({ where: { ...(nurse && { nurseId: nurse.id }), status: 'Pending' } }),
        prisma.careRequest.findMany({
          where: { ...(nurse && { nurseId: nurse.id }) },
          distinct: ['patientId'],
          select: { patientId: true },
        }),
      ]);
      const activePatients = nursePatients.length;

      return {
        role: Role.NURSE,
        nurseName: nurse?.fullName,
        totalVisits,
        pendingVisits,
        activePatients,
      };
    }

    if (role === Role.CAREGIVER) {
      const caregiver = await prisma.caregiver.findUnique({
        where: { userId },
        include: { patients: { select: { id: true } }, patientLinks: { where: { consentStatus: 'ACTIVE' } } },
      });
      const linkedIds = Array.from(
        new Set([
          ...(caregiver?.patients.map((p) => p.id) || []),
          ...(caregiver?.patientLinks.map((l) => l.patientId) || []),
        ])
      );
      const [pendingTasks, completedTasks, activeAlerts] = await Promise.all([
        caregiver
          ? prisma.caregiverTask.count({ where: { caregiverId: caregiver.id, status: 'Pending' } })
          : 0,
        caregiver
          ? prisma.caregiverTask.count({ where: { caregiverId: caregiver.id, status: 'Completed' } })
          : 0,
        linkedIds.length > 0
          ? prisma.sosAlert.count({ where: { patientId: { in: linkedIds }, status: 'ACTIVE' } })
          : 0,
      ]);

      return {
        role: Role.CAREGIVER,
        caregiverName: caregiver?.fullName,
        linkedWardsCount: linkedIds.length,
        pendingTasks,
        completedTasks,
        activeAlerts,
      };
    }

    if (role === Role.INSURANCE_PROVIDER) {
      const provider = await prisma.insuranceProvider.findUnique({ where: { userId } });
      const policyScope = provider ? { OR: [{ providerId: provider.id }, { providerId: null }] } : {};
      const [totalPolicies, activePolicies, totalClaims, pendingClaims, pendingPreAuths, settledCount] =
        await Promise.all([
          prisma.insurancePolicy.count({ where: policyScope }),
          prisma.insurancePolicy.count({ where: { policyStatus: 'Active', ...policyScope } }),
          prisma.insuranceClaim.count({ where: { policy: policyScope } }),
          prisma.insuranceClaim.count({ where: { status: { in: ['New', 'Under Review'] }, policy: policyScope } }),
          prisma.preAuthorization.count({ where: { status: 'Pending', policy: policyScope } }),
          prisma.claimSettlement.count({ where: { claim: { policy: policyScope } } }),
        ]);

      return {
        role: Role.INSURANCE_PROVIDER,
        providerName: provider?.providerName,
        totalPolicies,
        activePolicies,
        totalClaims,
        pendingClaims,
        pendingPreAuths,
        settledCount,
      };
    }

    if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN) {
      throw new AppError('Unauthorized dashboard role', 403);
    }

    // ADMIN & SUPER_ADMIN (Comprehensive Real System Intelligence)
    const [
      totalUsers,
      totalPatients,
      totalDoctors,
      totalNurses,
      totalPharmacists,
      totalCaregivers,
      totalInsurance,
      totalPharmacies,
      totalPrescriptions,
      totalOrders,
      totalAppointments,
      totalRecords,
      userRoleGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.nurse.count(),
      prisma.pharmacist.count(),
      prisma.caregiver.count(),
      prisma.insuranceProvider.count(),
      prisma.pharmacy.count(),
      prisma.prescription.count(),
      prisma.pharmacyOrder.count(),
      prisma.appointment.count(),
      prisma.medicalRecord.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const roleDistribution: Record<string, number> = {};
    for (const group of userRoleGroups) {
      roleDistribution[group.role] = group._count.id;
    }

    return {
      role: role === Role.SUPER_ADMIN ? Role.SUPER_ADMIN : Role.ADMIN,
      totalUsers,
      totalPatients,
      totalDoctors,
      totalNurses,
      totalPharmacists,
      totalCaregivers,
      totalInsurance,
      totalPharmacies,
      totalPrescriptions,
      totalOrders,
      totalAppointments,
      totalRecords,
      roleDistribution,
      systemHealth: 'Optimal',
    };
  }
}
