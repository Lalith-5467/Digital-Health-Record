import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { ConsultationStatus, AppointmentStatus, PrescriptionStatus, Role } from '@prisma/client';

async function assertAppointmentParticipant(
  req: Request,
  appointment: { patientId: string; doctorId: string },
  allowPatient = false
): Promise<boolean> {
  const user = req.user!;
  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.DOCTOR) {
    const doc = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true } });
    return Boolean(doc && doc.id === appointment.doctorId);
  }
  if (allowPatient && user.role === Role.PATIENT) {
    const pat = await prisma.patient.findUnique({ where: { userId: user.id }, select: { id: true } });
    return Boolean(pat && pat.id === appointment.patientId);
  }
  return false;
}

export const getConsultationByAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointmentId = id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
            medicalRecords: { orderBy: { recordDate: 'desc' }, take: 5 },
            prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 3 }
          }
        },
        doctor: true,
      }
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const authorized = await assertAppointmentParticipant(req, appointment, true);
    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not a participant of this consultation' });
    }

    let consultation = await prisma.consultation.findUnique({
      where: { appointmentId }
    });

    res.status(200).json({
      success: true,
      data: {
        appointment,
        consultation
      }
    });
  } catch (error) {
    next(error);
  }
};

export const startConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointmentId = id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const authorized = await assertAppointmentParticipant(req, appointment, false);
    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only the assigned doctor may start this consultation' });
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot start a completed or cancelled appointment' });
    }

    // Update appointment status if needed
    if (appointment.status === 'PENDING') {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CONFIRMED' }
      });
    }

    let consultation;
    try {
      consultation = await prisma.consultation.upsert({
        where: { appointmentId },
        update: {
          status: ConsultationStatus.IN_PROGRESS,
          startedAt: new Date()
        },
        create: {
          appointmentId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: ConsultationStatus.IN_PROGRESS,
          startedAt: new Date()
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        consultation = await prisma.consultation.findUnique({ where: { appointmentId } });
      } else {
        throw e;
      }
    }

    res.status(200).json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
};

export const updateConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const consultationId = id as string;
    const { chiefComplaint, symptoms, clinicalNotes, diagnosis, treatmentPlan, followUpInstructions } = req.body;

    const existing = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }
    const authorized = await assertAppointmentParticipant(req, existing, false);
    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only the assigned doctor may update this consultation' });
    }

    const consultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        chiefComplaint,
        symptoms,
        clinicalNotes,
        diagnosis,
        treatmentPlan,
        followUpInstructions,
      }
    });

    res.status(200).json({ success: true, data: consultation });
  } catch (error) {
    next(error);
  }
};

export const completeConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const consultationId = id as string;
    const { medicines } = req.body; // medicines array for prescription

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { appointment: true }
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }

    const authorized = await assertAppointmentParticipant(req, consultation, false);
    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only the assigned doctor may complete this consultation' });
    }

    if (consultation.status === ConsultationStatus.COMPLETED) {
      return res.status(400).json({ success: false, message: 'Consultation is already completed' });
    }

    const completedAt = new Date();

    // Use a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Consultation
      const updatedConsultation = await tx.consultation.update({
        where: { id: consultationId },
        data: {
          status: ConsultationStatus.COMPLETED,
          completedAt
        }
      });

      // 2. Update Appointment
      await tx.appointment.update({
        where: { id: consultation.appointmentId },
        data: { status: AppointmentStatus.COMPLETED }
      });

      // 3. Create Prescription, PatientMedications & Consultation MedicalRecord atomically
      const docRecord = await tx.doctor.findUnique({ where: { id: consultation.doctorId } });
      let createdPrescriptionId: string | null = null;

      if (medicines && medicines.length > 0) {
        const prescription = await tx.prescription.create({
          data: {
            patientId: consultation.patientId,
            doctorId: consultation.doctorId,
            diagnosis: consultation.diagnosis,
            notes: consultation.clinicalNotes || consultation.followUpInstructions || null,
            status: PrescriptionStatus.CONFIRMED,
          }
        });
        createdPrescriptionId = prescription.id;

        for (const med of medicines) {
          const durDays = parseInt(med.durationDays) || 5;
          await tx.prescriptionItem.create({
            data: {
              prescriptionId: prescription.id,
              medicineName: med.name,
              dosage: med.dosage,
              unit: med.unit || 'Tablet',
              frequency: med.frequency,
              route: med.route,
              durationDays: durDays,
              foodInstruction: med.foodInstruction,
              instructions: med.instructions
            }
          });

          await tx.patientMedication.create({
            data: {
              patientId: consultation.patientId,
              sourcePrescriptionId: prescription.id,
              name: med.name,
              dosage: med.dosage,
              unit: med.unit || 'Tablet',
              frequency: med.frequency || 'Twice daily',
              route: med.route || 'Oral',
              prescribedBy: docRecord?.fullName || 'Attending Physician',
              hospital: docRecord?.hospital || null,
              foodInstruction: med.foodInstruction || 'After Food',
              instructions: med.instructions || null,
              status: 'active',
              totalDoses: durDays * 2,
              remainingDoses: durDays * 2,
              startDate: completedAt,
              endDate: new Date(completedAt.getTime() + durDays * 24 * 60 * 60 * 1000),
            }
          });
        }
      }

      // 4. Persist Consultation Summary as MedicalRecord in MySQL
      await tx.medicalRecord.create({
        data: {
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          title: `Consultation Summary${consultation.diagnosis ? ` - ${consultation.diagnosis}` : ''}`,
          type: 'CONSULTATION',
          hospital: docRecord?.hospital || 'MediCare Clinic',
          status: 'Reviewed',
          notes: [
            consultation.chiefComplaint ? `Chief Complaint: ${consultation.chiefComplaint}` : '',
            consultation.diagnosis ? `Diagnosis: ${consultation.diagnosis}` : '',
            consultation.treatmentPlan ? `Treatment Plan: ${consultation.treatmentPlan}` : '',
            consultation.followUpInstructions ? `Follow-Up: ${consultation.followUpInstructions}` : '',
          ].filter(Boolean).join('\n') || 'Consultation completed.',
          recordDate: completedAt,
        }
      });

      return { ...updatedConsultation, prescriptionId: createdPrescriptionId };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
