import { prisma } from '../config/prisma';
import { AppointmentStatus, AppointmentType, Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { CaregiverService } from './caregiver.service';

export interface CreateAppointmentDTO {
  doctorId: string;
  patientId?: string;
  appointmentDate: string | Date;
  slotTime: string;
  type?: AppointmentType;
  reason?: string;
  notes?: string;
  meetingLink?: string;
}

export interface UpdateAppointmentDTO {
  appointmentDate?: string | Date;
  slotTime?: string;
  status?: AppointmentStatus;
  notes?: string;
  meetingLink?: string;
  cancellationReason?: string;
}

export class AppointmentService {
  /**
   * Get appointments for a user based on their role
   */
  static async getAppointments(userId: string, role: Role) {
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);

      return prisma.appointment.findMany({
        where: { patientId: patient.id },
        include: {
          doctor: {
            include: {
              user: { select: { email: true, phoneNumber: true } },
            },
          },
        },
        orderBy: { appointmentDate: 'asc' },
      });
    }

    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) throw new AppError('Doctor profile not found', 404);

      return prisma.appointment.findMany({
        where: { doctorId: doctor.id },
        include: {
          patient: {
            include: {
              user: { select: { email: true, phoneNumber: true, abhaId: true } },
            },
          },
        },
        orderBy: { appointmentDate: 'asc' },
      });
    }

    if (role === Role.CAREGIVER) {
      const wards = await CaregiverService.getWards(userId, role);
      const wardIds = wards.map((w: any) => w.id);
      if (wardIds.length === 0) return [];
      return prisma.appointment.findMany({
        where: { patientId: { in: wardIds } },
        include: {
          patient: true,
          doctor: true,
        },
        orderBy: { appointmentDate: 'asc' },
      });
    }

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN || role === Role.NURSE) {
      return prisma.appointment.findMany({
        include: {
          patient: true,
          doctor: true,
        },
        orderBy: { appointmentDate: 'asc' },
      });
    }

    throw new AppError('Forbidden: You do not have permission to view appointments', 403);
  }

  /**
   * Verify appointment ownership/access for the requesting user
   */
  private static async assertAppointmentAccess(
    appointment: { patientId: string; doctorId: string; patient?: { userId: string } | null; doctor?: { userId: string } | null },
    userId: string,
    role: Role
  ) {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) return;

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
      if (patient && appointment.patientId === patient.id) return;
      throw new AppError('Forbidden: You do not have access to this appointment', 403);
    }

    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
      if (doctor && appointment.doctorId === doctor.id) return;
      throw new AppError('Forbidden: You are not the assigned doctor for this appointment', 403);
    }

    if (role === Role.CAREGIVER) {
      await CaregiverService.validateCaregiverAccess(userId, role, appointment.patientId);
      return;
    }

    if (role === Role.NURSE) {
      const nurse = await prisma.nurse.findUnique({ where: { userId }, select: { id: true } });
      if (nurse) {
        const assigned = await prisma.careRequest.findFirst({
          where: { nurseId: nurse.id, patientId: appointment.patientId },
          select: { id: true },
        });
        if (assigned) return;
      }
      throw new AppError('Forbidden: You are not assigned to this patient', 403);
    }

    throw new AppError('Forbidden: Insufficient permissions to access this appointment', 403);
  }

  /**
   * Get single appointment by ID (sanitized — never exposes passwordHash — and ownership-checked)
   */
  static async getAppointmentById(id: string, userId: string, role: Role) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: { select: { id: true, email: true, phoneNumber: true, abhaId: true, role: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { id: true, email: true, phoneNumber: true, role: true } },
          },
        },
      },
    });

    if (!appointment) throw new AppError('Appointment not found', 404);
    await this.assertAppointmentAccess(appointment, userId, role);
    return appointment;
  }

  /**
   * Create a new appointment booking
   */
  static async createAppointment(userId: string, role: Role, data: CreateAppointmentDTO) {
    let patientId = data.patientId;

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new AppError('Patient profile not found', 404);
      patientId = patient.id;
    } else if (role === Role.CAREGIVER) {
      if (!patientId) throw new AppError('Patient ID is required', 400);
      await CaregiverService.validateCaregiverAccess(userId, role, patientId);
    } else if (role !== Role.DOCTOR && role !== Role.ADMIN && role !== Role.SUPER_ADMIN && role !== Role.NURSE) {
      throw new AppError('Forbidden: Your role cannot book appointments', 403);
    }

    if (!patientId) throw new AppError('Patient ID is required', 400);

    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [
          { id: data.doctorId },
          { userId: data.doctorId },
          { fullName: { contains: data.doctorId } },
        ],
      },
    });

    if (!doctor) throw new AppError('Doctor not found', 404);

    const targetDate = new Date(data.appointmentDate);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Prevent double-booking same doctor + date + slotTime
    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        slotTime: data.slotTime,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
    });

    if (conflict) {
      throw new AppError(`Slot ${data.slotTime} is already booked for ${doctor.fullName}. Please choose another slot.`, 409);
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        appointmentDate: targetDate,
        slotTime: data.slotTime,
        type: data.type || AppointmentType.VIDEO,
        status: AppointmentStatus.CONFIRMED,
        fee: data.type === AppointmentType.VIDEO && doctor.onlineFee ? doctor.onlineFee : (doctor.inPersonFee || doctor.consultationFee),
        reason: data.reason || 'General Consultation',
        notes: data.notes || '',
        meetingLink: data.type === AppointmentType.VIDEO ? (data.meetingLink || null) : null,
      },
      include: {
        doctor: true,
        patient: true,
      },
    });

    // Create Notification for Patient
    const patientRecord = await prisma.patient.findUnique({ where: { id: patientId } });
    if (patientRecord) {
      await prisma.notification.create({
        data: {
          userId: patientRecord.userId,
          title: 'Appointment Confirmed',
          message: `Your appointment with ${doctor.fullName} on ${new Date(data.appointmentDate).toLocaleDateString()} at ${data.slotTime} is confirmed.`,
          type: 'APPOINTMENT',
          category: 'Appointment',
          relatedModule: 'appointments',
        },
      });
    }

    // Create Notification for Doctor
    if (doctor.userId) {
      await prisma.notification.create({
        data: {
          userId: doctor.userId,
          title: 'New Appointment Booked',
          message: `Patient ${patientRecord?.fullName || 'Patient'} booked an appointment on ${new Date(data.appointmentDate).toLocaleDateString()} at ${data.slotTime}.`,
          type: 'APPOINTMENT',
          category: 'Appointment',
          relatedModule: 'appointments',
        },
      });
    }

    return appointment;
  }

  /**
   * Update appointment details or status (ownership-checked)
   */
  static async updateAppointment(id: string, data: UpdateAppointmentDTO, userId: string, role: Role) {
    const existing = await prisma.appointment.findUnique({ 
      where: { id },
      include: { doctor: true, patient: true },
    });
    if (!existing) throw new AppError('Appointment not found', 404);
    await this.assertAppointmentAccess(existing, userId, role);

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.appointmentDate && { appointmentDate: new Date(data.appointmentDate) }),
        ...(data.slotTime && { slotTime: data.slotTime }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.meetingLink !== undefined && { meetingLink: data.meetingLink }),
        ...(data.cancellationReason !== undefined && { cancellationReason: data.cancellationReason }),
      },
      include: {
        doctor: true,
        patient: true,
      },
    });

    // Notify patient when status changes
    if (data.status && data.status !== existing.status && updated.patient?.userId) {
      await prisma.notification.create({
        data: {
          userId: updated.patient.userId,
          title: `Appointment ${updated.status}`,
          message: `Your appointment with ${updated.doctor.fullName} on ${new Date(updated.appointmentDate).toLocaleDateString()} is now ${updated.status.toLowerCase()}.`,
          type: 'APPOINTMENT',
          category: 'Appointment',
          relatedModule: 'appointments',
        },
      });
    }

    return updated;
  }

  /**
   * Cancel appointment (ownership-checked)
   */
  static async cancelAppointment(id: string, reason: string | undefined, userId: string, role: Role) {
    return this.updateAppointment(id, {
      status: AppointmentStatus.CANCELLED,
      cancellationReason: reason || 'Cancelled by user',
    }, userId, role);
  }
}
