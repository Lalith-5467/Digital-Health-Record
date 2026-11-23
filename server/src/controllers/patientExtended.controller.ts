import { Request, Response, NextFunction } from 'express';
import { Role, FamilyConnectionStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { CaregiverService } from '../services/caregiver.service';

async function resolvePatientId(req: Request): Promise<string> {
  const user = req.user!;
  const explicit =
    (typeof req.query.patientId === 'string' && req.query.patientId) ||
    (req.body?.patientId && String(req.body.patientId)) ||
    undefined;

  if (user.role === Role.PATIENT) {
    const p = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!p) throw new AppError('Patient profile not found', 404);
    if (explicit && explicit !== p.id) {
      throw new AppError('Forbidden: cannot access another patient record', 403);
    }
    return p.id;
  }

  if (user.role === Role.CAREGIVER) {
    if (!explicit) throw new AppError('patientId is required for caregiver access', 400);
    await CaregiverService.validateCaregiverAccess(user.id, user.role, explicit);
    return explicit;
  }

  if (user.role === Role.DOCTOR || user.role === Role.NURSE || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    if (explicit) return explicit;
    const own = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (own) return own.id;
    throw new AppError('patientId is required', 400);
  }

  throw new AppError('Forbidden: Insufficient role to access patient records', 403);
}

// ==========================================
// 1. FAMILY CONNECT (CONNECTIONS, MESSAGES, SHARED ITEMS)
// ==========================================
export const getFamilyConnections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const list = await prisma.familyConnection.findMany({
      where: { patientId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
        sharedItems: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const createFamilyConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { memberName, relationship, contact, email, permissions } = req.body;
    if (!memberName || !relationship || !contact) {
      throw new AppError('memberName, relationship, and contact are required', 400);
    }
    const matchedUser = email
      ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
      : null;

    const created = await prisma.familyConnection.create({
      data: {
        patientId,
        memberUserId: matchedUser?.id || null,
        memberName: String(memberName).trim(),
        relationship: String(relationship).trim(),
        contact: String(contact).trim(),
        email: email ? String(email).toLowerCase().trim() : null,
        status: FamilyConnectionStatus.CONNECTED,
        permissionsJson: permissions ? JSON.stringify(permissions) : null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateFamilyConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.familyConnection.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Family connection not found', 404);

    const { status, permissions, relationship, contact } = req.body;
    const updated = await prisma.familyConnection.update({
      where: { id },
      data: {
        ...(status ? { status: status as FamilyConnectionStatus } : {}),
        ...(permissions !== undefined ? { permissionsJson: JSON.stringify(permissions) } : {}),
        ...(relationship ? { relationship } : {}),
        ...(contact ? { contact } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteFamilyConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.familyConnection.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Family connection not found', 404);
    await prisma.familyConnection.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Family connection removed' });
  } catch (err) {
    next(err);
  }
};

export const getFamilyMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const connectionId = String(req.params.connectionId);
    const conn = await prisma.familyConnection.findFirst({ where: { id: connectionId, patientId } });
    if (!conn) throw new AppError('Family connection not found', 404);
    const messages = await prisma.familyMessage.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export const postFamilyMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const connectionId = String(req.params.connectionId);
    const conn = await prisma.familyConnection.findFirst({ where: { id: connectionId, patientId } });
    if (!conn) throw new AppError('Family connection not found', 404);
    const { text } = req.body;
    if (!text || !String(text).trim()) throw new AppError('text is required', 400);

    const created = await prisma.familyMessage.create({
      data: {
        connectionId,
        senderUserId: req.user!.id,
        text: String(text).trim(),
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const createFamilySharedItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { connectionId, itemType, itemId, title, metadata } = req.body;
    if (!connectionId || !itemType || !itemId) {
      throw new AppError('connectionId, itemType, and itemId are required', 400);
    }
    const created = await prisma.familySharedItem.create({
      data: {
        patientId,
        connectionId,
        itemType: String(itemType),
        itemId: String(itemId),
        title: title || null,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. HOSPITALS DIRECTORY, SAVED HOSPITALS & REVIEWS
// ==========================================
export const getPatientHospitals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } });

    const [hospitals, saved] = await Promise.all([
      prisma.hospital.findMany({
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
        include: { reviews: { orderBy: { createdAt: 'desc' }, take: 5 } },
        orderBy: { name: 'asc' },
      }),
      patient
        ? prisma.patientSavedHospital.findMany({ where: { patientId: patient.id, isSaved: true } })
        : Promise.resolve([]),
    ]);

    const savedSet = new Set(saved.map((s) => s.hospitalId));
    const enriched = hospitals.map((h) => ({
      ...h,
      isSaved: savedSet.has(h.id),
      averageRating:
        h.reviews.length > 0
          ? Number((h.reviews.reduce((s, r) => s + r.rating, 0) / h.reviews.length).toFixed(1))
          : 0,
    }));

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

export const toggleSaveHospital = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const hospitalId = String(req.params.hospitalId);
    const existing = await prisma.patientSavedHospital.findUnique({
      where: { patientId_hospitalId: { patientId, hospitalId } },
    });
    const nextSaved = req.body?.isSaved !== undefined ? Boolean(req.body.isSaved) : !(existing?.isSaved ?? false);

    const saved = await prisma.patientSavedHospital.upsert({
      where: { patientId_hospitalId: { patientId, hospitalId } },
      create: { patientId, hospitalId, isSaved: nextSaved },
      update: { isSaved: nextSaved, viewedAt: new Date() },
    });
    res.status(200).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
};

export const createHospitalReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = String(req.params.hospitalId);
    const { rating, comment } = req.body;
    const numRating = Math.min(5, Math.max(1, Number(rating || 5)));
    const created = await prisma.hospitalReview.create({
      data: {
        hospitalId,
        userId: req.user!.id,
        rating: numRating,
        comment: comment || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. LAB TEST BOOKINGS
// ==========================================
export const getLabTestBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const list = await prisma.labTestBooking.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const createLabTestBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { testName, category, labName, collectionType, scheduledDate, scheduledTime, price, notes } = req.body;
    if (!testName) throw new AppError('testName is required', 400);

    const created = await prisma.labTestBooking.create({
      data: {
        patientId,
        testName: String(testName).trim(),
        category: category || 'Diagnostics',
        labName: labName || 'Certified Diagnostics Lab',
        collectionType: collectionType || 'Home Collection',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        scheduledTime: scheduledTime || '08:00 AM',
        price: Number(price ?? 0),
        status: 'Scheduled',
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateLabTestBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.labTestBooking.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Lab test booking not found', 404);

    const { status, resultValue, resultUnit, referenceRange, reportUrl, notes } = req.body;
    const updated = await prisma.labTestBooking.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(resultValue !== undefined ? { resultValue } : {}),
        ...(resultUnit !== undefined ? { resultUnit } : {}),
        ...(referenceRange !== undefined ? { referenceRange } : {}),
        ...(reportUrl !== undefined ? { reportUrl } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteLabTestBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.labTestBooking.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Lab test booking not found', 404);
    await prisma.labTestBooking.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Lab test booking deleted' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. SANITATION / HOME DISINFECTION BOOKINGS
// ==========================================
export const getSanitationBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const list = await prisma.sanitationBooking.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const createSanitationBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { serviceType, packageName, scheduledDate, scheduledTime, address, areaSqFt, price, notes } = req.body;
    if (!serviceType || !address) throw new AppError('serviceType and address are required', 400);

    const created = await prisma.sanitationBooking.create({
      data: {
        patientId,
        serviceType: String(serviceType).trim(),
        packageName: packageName || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        scheduledTime: scheduledTime || '10:00 AM',
        address: String(address).trim(),
        areaSqFt: areaSqFt !== undefined ? Number(areaSqFt) : null,
        price: Number(price ?? 0),
        status: 'Scheduled',
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateSanitationBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.sanitationBooking.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Sanitation booking not found', 404);

    const updated = await prisma.sanitationBooking.update({
      where: { id },
      data: {
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. REPORT INSIGHTS
// ==========================================
export const getReportInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const list = await prisma.reportInsight.findMany({
      where: { patientId },
      include: { medicalRecord: { select: { id: true, title: true, recordDate: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const createReportInsight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { medicalRecordId, title, category, summary, priority, metrics } = req.body;
    if (!title || !summary) throw new AppError('title and summary are required', 400);

    const created = await prisma.reportInsight.create({
      data: {
        patientId,
        medicalRecordId: medicalRecordId || null,
        title: String(title).trim(),
        category: category || 'General',
        summary: String(summary).trim(),
        priority: priority || 'Normal',
        reviewStatus: 'pending',
        metricsJson: metrics ? JSON.stringify(metrics) : null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateReportInsight = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.reportInsight.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Report insight not found', 404);

    const updated = await prisma.reportInsight.update({
      where: { id },
      data: {
        ...(req.body.reviewStatus !== undefined ? { reviewStatus: req.body.reviewStatus } : {}),
        ...(req.body.summary !== undefined ? { summary: req.body.summary } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. DIET ASSESSMENT
// ==========================================
export const getDietAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const latest = await prisma.dietAssessment.findFirst({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
    });
    res.status(200).json({ success: true, data: latest });
  } catch (err) {
    next(err);
  }
};

export const saveDietAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { goal, dietPreference, activityLevel, targetCalories, allergies, conditions, checklist, notes } = req.body;
    const existing = await prisma.dietAssessment.findFirst({ where: { patientId } });

    const payload = {
      goal: goal || null,
      dietPreference: dietPreference || null,
      activityLevel: activityLevel || null,
      targetCalories: targetCalories !== undefined ? Number(targetCalories) : null,
      allergiesJson: allergies !== undefined ? JSON.stringify(allergies) : null,
      conditionsJson: conditions !== undefined ? JSON.stringify(conditions) : null,
      checklistJson: checklist !== undefined ? JSON.stringify(checklist) : null,
      notes: notes || null,
    };

    const saved = existing
      ? await prisma.dietAssessment.update({ where: { id: existing.id }, data: payload })
      : await prisma.dietAssessment.create({ data: { patientId, ...payload } });

    res.status(200).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. AI ASSISTANT CONVERSATIONS & SAVED HEALTH NOTES
// ==========================================
export const getAiConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const list = await prisma.aiConversation.findMany({
      where: { patientId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

export const createAiConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { title, topic } = req.body;
    const created = await prisma.aiConversation.create({
      data: {
        patientId,
        title: title || 'Health Consultation',
        topic: topic || null,
      },
      include: { messages: true },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const postAiMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const conversationId = String(req.params.id);
    const conv = await prisma.aiConversation.findFirst({ where: { id: conversationId, patientId } });
    if (!conv) throw new AppError('AI conversation not found', 404);

    const { sender, text, metadata } = req.body;
    if (!text || !String(text).trim()) throw new AppError('text is required', 400);

    const created = await prisma.aiMessage.create({
      data: {
        conversationId,
        sender: sender === 'assistant' ? 'assistant' : 'user',
        text: String(text).trim(),
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteAiConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const conv = await prisma.aiConversation.findFirst({ where: { id, patientId } });
    if (!conv) throw new AppError('AI conversation not found', 404);
    await prisma.aiConversation.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
};

export const getSavedHealthNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const notes = await prisma.savedHealthNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
};

export const createSavedHealthNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const { title, content, category } = req.body;
    if (!title || !content) throw new AppError('title and content are required', 400);
    const created = await prisma.savedHealthNote.create({
      data: {
        patientId,
        title: String(title).trim(),
        content: String(content).trim(),
        category: category || 'General',
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const deleteSavedHealthNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = await resolvePatientId(req);
    const id = String(req.params.id);
    const existing = await prisma.savedHealthNote.findFirst({ where: { id, patientId } });
    if (!existing) throw new AppError('Health note not found', 404);
    await prisma.savedHealthNote.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Health note deleted' });
  } catch (err) {
    next(err);
  }
};
