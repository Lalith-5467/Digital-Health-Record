import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';
import { CaregiverService } from '../services/caregiver.service';

async function resolvePatientId(req: Request): Promise<string> {
  const user = req.user!;
  const requestedPatientId =
    (typeof req.query.patientId === 'string' && req.query.patientId) ||
    (req.body && typeof req.body.patientId === 'string' && req.body.patientId) ||
    undefined;

  if (user.role === Role.PATIENT) {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) throw new AppError('Patient profile not found', 404);
    if (requestedPatientId && requestedPatientId !== patient.id) {
      throw new AppError('Forbidden: cannot access another patient record', 403);
    }
    return patient.id;
  }

  if (user.role === Role.CAREGIVER) {
    if (!requestedPatientId) throw new AppError('patientId is required for caregiver access', 400);
    await CaregiverService.validateCaregiverAccess(user.id, user.role, requestedPatientId);
    return requestedPatientId;
  }

  if (user.role === Role.DOCTOR || user.role === Role.NURSE || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    if (requestedPatientId) return requestedPatientId;
    throw new AppError('patientId is required for non-patient roles', 400);
  }

  throw new AppError('Forbidden: Insufficient role to access patient clinical records', 403);
}

// ==========================================
// ALLERGIES (patient_allergies)
// ==========================================
export const getAllergies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.patientAllergy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createAllergy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { allergen, name, category, severity, reaction, diagnosedDate, notes } = req.body;
    const allergenName = (allergen || name || '').trim();
    if (!allergenName) throw new AppError('Allergen name is required', 400);

    const created = await prisma.patientAllergy.create({
      data: {
        patientId,
        allergen: allergenName,
        category: category || 'Medication',
        severity: severity || 'Moderate',
        reaction: reaction || null,
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        notes: notes || null,
      },
    });
    await AuditService.log({
      userId: req.user!.id,
      action: 'ALLERGY_ADDED',
      entityType: 'patient_allergies',
      entityId: created.id,
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteAllergy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.patientAllergy.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Allergy record not found', 404);
    await prisma.patientAllergy.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Allergy deleted' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// CHRONIC CONDITIONS (patient_conditions)
// ==========================================
export const getConditions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.patientCondition.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createCondition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { name, status, severity, diagnosedDate, treatingDoctor, notes } = req.body;
    if (!name || !String(name).trim()) throw new AppError('Condition name is required', 400);

    const created = await prisma.patientCondition.create({
      data: {
        patientId,
        name: String(name).trim(),
        status: status || 'Active',
        severity: severity || 'Moderate',
        diagnosedDate: diagnosedDate ? new Date(diagnosedDate) : null,
        treatingDoctor: treatingDoctor || null,
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteCondition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.patientCondition.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Condition record not found', 404);
    await prisma.patientCondition.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Condition deleted' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// SURGERIES (patient_surgeries)
// ==========================================
export const getSurgeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.patientSurgery.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createSurgery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { procedureName, name, surgeryDate, date, hospital, surgeon, outcome, notes } = req.body;
    const title = (procedureName || name || '').trim();
    if (!title) throw new AppError('Surgery procedure name is required', 400);

    const created = await prisma.patientSurgery.create({
      data: {
        patientId,
        procedureName: title,
        surgeryDate: surgeryDate || date ? new Date(surgeryDate || date) : null,
        hospital: hospital || null,
        surgeon: surgeon || null,
        outcome: outcome || 'Successful',
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteSurgery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.patientSurgery.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Surgery record not found', 404);
    await prisma.patientSurgery.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Surgery deleted' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// WELLNESS LOGS (patient_wellness_logs)
// ==========================================
export const getWellnessLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.patientWellnessLog.findMany({
      where: { patientId },
      orderBy: { logDate: 'desc' },
      take: 30,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createWellnessLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { sleepHours, steps, exerciseMinutes, hydrationLiters, stressLevel, notes, logDate } = req.body;
    const created = await prisma.patientWellnessLog.create({
      data: {
        patientId,
        logDate: logDate ? new Date(logDate) : new Date(),
        sleepHours: sleepHours != null ? Number(sleepHours) : null,
        steps: steps != null ? parseInt(String(steps), 10) : null,
        exerciseMinutes: exerciseMinutes != null ? parseInt(String(exerciseMinutes), 10) : null,
        hydrationLiters: hydrationLiters != null ? Number(hydrationLiters) : null,
        stressLevel: stressLevel || null,
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// EMERGENCY CONTACTS & SOS ALERTS
// ==========================================
export const getEmergencyContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.emergencyContact.findMany({
      where: { patientId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createEmergencyContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { name, relationship, relation, phone, priority } = req.body;
    if (!name || !phone) throw new AppError('Contact name and phone are required', 400);

    const created = await prisma.emergencyContact.create({
      data: {
        patientId,
        name: String(name).trim(),
        relationship: (relationship || relation || 'Family').trim(),
        phone: String(phone).trim(),
        priority: String(priority || 'PRIMARY').toUpperCase(),
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateEmergencyContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.emergencyContact.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Emergency contact not found', 404);
    const { name, relationship, relation, phone, priority } = req.body;
    const updated = await prisma.emergencyContact.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(relationship !== undefined || relation !== undefined
          ? { relationship: String(relationship || relation).trim() }
          : {}),
        ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
        ...(priority !== undefined ? { priority: String(priority).toUpperCase() } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteEmergencyContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.emergencyContact.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Emergency contact not found', 404);
    await prisma.emergencyContact.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Emergency contact removed' });
  } catch (err) {
    next(err);
  }
};

export const getSosAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.sosAlert.findMany({
      where: { patientId },
      orderBy: { triggeredAt: 'desc' },
      take: 30,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const triggerSosAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { eventType, latitude, longitude, locationLabel, notes } = req.body;

    const contacts = await prisma.emergencyContact.findMany({
      where: { patientId, isActive: true },
    });

    const alert = await prisma.sosAlert.create({
      data: {
        patientId,
        triggeredByUserId: req.user!.id,
        eventType: eventType || 'EMERGENCY_SOS',
        status: 'ACTIVE',
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        locationLabel: locationLabel || null,
        notifiedContactsJson: JSON.stringify(contacts.map((c) => ({ name: c.name, phone: c.phone }))),
        notes: notes || null,
      },
    });

    // Notify linked caregivers in MySQL Notification table
    const links = await prisma.patientCaregiverLink.findMany({
      where: { patientId, consentStatus: 'ACTIVE' },
      include: { caregiver: true },
    });
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    for (const l of links) {
      await prisma.notification.create({
        data: {
          userId: l.caregiver.userId,
          title: 'EMERGENCY SOS ALERT',
          message: `SOS alert triggered for ${patient?.fullName || 'Patient'}${locationLabel ? ` at ${locationLabel}` : ''}.`,
          type: 'EMERGENCY',
          category: 'Emergency',
          relatedModule: 'emergency',
        },
      });
    }

    await AuditService.log({
      userId: req.user!.id,
      action: 'SOS_TRIGGERED',
      entityType: 'sos_alerts',
      entityId: alert.id,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

export const resolveSosAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.sosAlert.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('SOS alert not found', 404);
    const status = req.body.status === 'CANCELLED' ? 'CANCELLED' : 'RESOLVED';
    const updated = await prisma.sosAlert.update({
      where: { id: existing.id },
      data: { status, resolvedAt: new Date(), notes: req.body.notes ?? existing.notes },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// HEALTH GOALS & ANALYTICS SUMMARY
// ==========================================
export const getHealthGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.healthGoal.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createHealthGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { title, category, targetValue, target, currentValue, current, unit, startDate, endDate } = req.body;
    if (!title) throw new AppError('Goal title is required', 400);

    const created = await prisma.healthGoal.create({
      data: {
        patientId,
        title: String(title).trim(),
        category: category || 'General',
        targetValue: Number(targetValue ?? target ?? 100),
        currentValue: Number(currentValue ?? current ?? 0),
        unit: unit || 'units',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateHealthGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.healthGoal.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Health goal not found', 404);
    const { title, category, targetValue, currentValue, unit, isPaused, endDate } = req.body;
    const updated = await prisma.healthGoal.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(targetValue !== undefined ? { targetValue: Number(targetValue) } : {}),
        ...(currentValue !== undefined ? { currentValue: Number(currentValue) } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(isPaused !== undefined ? { isPaused: Boolean(isPaused) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteHealthGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.healthGoal.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Health goal not found', 404);
    await prisma.healthGoal.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Health goal deleted' });
  } catch (err) {
    next(err);
  }
};

export const getAnalyticsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const range = String(req.query.range || '30d');
    const days = range === '7d' ? 7 : range === '3m' ? 90 : range === '1y' ? 365 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [vitals, doseLogs, goals, appointments, records, wellnessLogs] = await Promise.all([
      prisma.vital.findMany({ where: { patientId, recordedAt: { gte: since } }, orderBy: { recordedAt: 'asc' } }),
      prisma.doseLog.findMany({ where: { patientId, logDate: { gte: since } }, orderBy: { logDate: 'asc' } }),
      prisma.healthGoal.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
      prisma.appointment.findMany({ where: { patientId, createdAt: { gte: since } }, orderBy: { appointmentDate: 'desc' }, take: 10 }),
      prisma.medicalRecord.findMany({ where: { patientId, createdAt: { gte: since } }, orderBy: { recordDate: 'desc' }, take: 10 }),
      prisma.patientWellnessLog.findMany({ where: { patientId, logDate: { gte: since } }, orderBy: { logDate: 'asc' } }),
    ]);

    const takenDoses = doseLogs.filter((d) => d.status === 'taken').length;
    const adherencePct = doseLogs.length > 0 ? Math.round((takenDoses / doseLogs.length) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        range,
        vitals,
        doseLogs,
        adherencePct,
        goals,
        wellnessLogs,
        recentAppointments: appointments,
        recentRecords: records,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// HEALTH CHECKUPS (health_checkups)
// ==========================================
export const getCheckups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const data = await prisma.healthCheckup.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const saveCheckup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { id, type, status, completionScore, answers, answersJson, draftStep, summaryNotes } = req.body;
    const serializedAnswers =
      answersJson !== undefined
        ? String(answersJson)
        : answers !== undefined
        ? JSON.stringify(answers)
        : null;
    const isCompleted = String(status || 'COMPLETED').toUpperCase() === 'COMPLETED';

    let checkup;
    if (id) {
      const existing = await prisma.healthCheckup.findFirst({ where: { id, patientId } });
      if (existing) {
        checkup = await prisma.healthCheckup.update({
          where: { id: existing.id },
          data: {
            type: type || existing.type,
            status: isCompleted ? 'COMPLETED' : 'DRAFT',
            completionScore: completionScore != null ? Number(completionScore) : existing.completionScore,
            answersJson: serializedAnswers ?? existing.answersJson,
            draftStep: draftStep != null ? Number(draftStep) : existing.draftStep,
            summaryNotes: summaryNotes ?? existing.summaryNotes,
            completedAt: isCompleted ? new Date() : existing.completedAt,
          },
        });
      }
    }

    if (!checkup) {
      checkup = await prisma.healthCheckup.create({
        data: {
          patientId,
          type: type || 'Comprehensive',
          status: isCompleted ? 'COMPLETED' : 'DRAFT',
          completionScore: completionScore != null ? Number(completionScore) : 0,
          answersJson: serializedAnswers,
          draftStep: draftStep != null ? Number(draftStep) : 0,
          summaryNotes: summaryNotes || null,
          completedAt: isCompleted ? new Date() : null,
        },
      });
    }

    res.status(201).json({ success: true, data: checkup });
  } catch (err) {
    next(err);
  }
};

export const deleteCheckup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const existing = await prisma.healthCheckup.findFirst({
      where: { id: String(req.params.id), patientId },
    });
    if (!existing) throw new AppError('Checkup not found', 404);
    await prisma.healthCheckup.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Checkup deleted' });
  } catch (err) {
    next(err);
  }
};

