import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';
import { ClinicalService } from '../services/clinical.service';

async function resolveNurseId(req: Request): Promise<string> {
  const user = req.user!;
  if (user.role === Role.NURSE) {
    const nurse = await prisma.nurse.findUnique({ where: { userId: user.id } });
    if (!nurse) throw new AppError('Nurse profile not found', 404);
    return nurse.id;
  }
  const explicit =
    (typeof req.query.nurseId === 'string' && req.query.nurseId) ||
    (req.body?.nurseId && String(req.body.nurseId)) ||
    undefined;
  if (explicit) return explicit;
  const first = await prisma.nurse.findFirst();
  if (!first) throw new AppError('No nurse profile found', 404);
  return first.id;
}

// ==========================================
// 1. NURSE INVENTORY
// ==========================================
export const getNurseInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const items = await prisma.nurseInventoryItem.findMany({
      where: { nurseId },
      orderBy: { itemName: 'asc' },
    });
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
};

export const createNurseInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const { itemName, category, quantity, minThreshold, unit, expiryDate, notes } = req.body;
    if (!itemName || !String(itemName).trim()) throw new AppError('itemName is required', 400);

    const created = await prisma.nurseInventoryItem.create({
      data: {
        nurseId,
        itemName: String(itemName).trim(),
        category: category || 'Consumables',
        quantity: Number(quantity ?? 0),
        minThreshold: Number(minThreshold ?? 5),
        unit: unit || 'units',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateNurseInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const id = String(req.params.id);
    const existing = await prisma.nurseInventoryItem.findFirst({ where: { id, nurseId } });
    if (!existing) throw new AppError('Inventory item not found', 404);

    const { itemName, category, quantity, minThreshold, unit, expiryDate, notes } = req.body;
    const updated = await prisma.nurseInventoryItem.update({
      where: { id },
      data: {
        ...(itemName !== undefined ? { itemName: String(itemName).trim() } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
        ...(minThreshold !== undefined ? { minThreshold: Number(minThreshold) } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteNurseInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const id = String(req.params.id);
    const existing = await prisma.nurseInventoryItem.findFirst({ where: { id, nurseId } });
    if (!existing) throw new AppError('Inventory item not found', 404);
    await prisma.nurseInventoryItem.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Inventory item deleted' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. NURSE RESTOCK REQUESTS
// ==========================================
export const getNurseRestockRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const rows = await prisma.nurseRestockRequest.findMany({
      where: { nurseId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const createNurseRestockRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const { itemName, quantity, urgency, notes } = req.body;
    if (!itemName || !String(itemName).trim()) throw new AppError('itemName is required', 400);

    const created = await prisma.nurseRestockRequest.create({
      data: {
        nurseId,
        itemName: String(itemName).trim(),
        quantity: Number(quantity ?? 10),
        urgency: urgency || 'Normal',
        status: 'Pending',
        notes: notes || null,
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      action: 'NURSE_RESTOCK_REQUESTED',
      entityType: 'NurseRestockRequest',
      entityId: created.id,
      details: { itemName: created.itemName, quantity: created.quantity },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateNurseRestockRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nurseId = await resolveNurseId(req);
    const id = String(req.params.id);
    const existing = await prisma.nurseRestockRequest.findFirst({ where: { id, nurseId } });
    if (!existing) throw new AppError('Restock request not found', 404);

    const { status, notes } = req.body;
    const updated = await prisma.nurseRestockRequest.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. CLINICAL ALERTS
// ==========================================
export const getClinicalAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const nurse = req.user!.role === Role.NURSE
      ? await prisma.nurse.findUnique({ where: { userId: req.user!.id } })
      : null;

    const alerts = await prisma.clinicalAlert.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(nurse ? { OR: [{ nurseId: nurse.id }, { nurseId: null }] } : {}),
      },
      include: {
        patient: { include: { user: { select: { phoneNumber: true, abhaId: true } } } },
        nurse: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.status(200).json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
};

export const createClinicalAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, severity, title, message } = req.body;
    if (!patientId || !title || !message) {
      throw new AppError('patientId, title, and message are required', 400);
    }
    const nurse = req.user!.role === Role.NURSE
      ? await prisma.nurse.findUnique({ where: { userId: req.user!.id } })
      : null;

    const created = await prisma.clinicalAlert.create({
      data: {
        patientId: String(patientId),
        nurseId: nurse?.id || null,
        severity: severity || 'HIGH',
        title: String(title).trim(),
        message: String(message).trim(),
        status: 'OPEN',
      },
      include: {
        patient: { select: { id: true, fullName: true } },
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateClinicalAlertStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    if (!status) throw new AppError('status is required', 400);

    const nurse = req.user!.role === Role.NURSE
      ? await prisma.nurse.findUnique({ where: { userId: req.user!.id } })
      : null;

    const existing = await prisma.clinicalAlert.findUnique({ where: { id } });
    if (!existing) throw new AppError('Clinical alert not found', 404);

    const upper = String(status).toUpperCase();
    const updated = await prisma.clinicalAlert.update({
      where: { id },
      data: {
        status: upper,
        ...(nurse && !existing.nurseId ? { nurseId: nurse.id } : {}),
        ...(upper === 'DISPATCHED' ? { dispatchedAt: new Date() } : {}),
        ...(upper === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        nurse: { select: { id: true, fullName: true } },
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      action: `CLINICAL_ALERT_${upper}`,
      entityType: 'ClinicalAlert',
      entityId: updated.id,
      details: { status: upper },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. CARE REQUEST CLINICAL NOTES, CHECKLIST & CANCEL
// ==========================================
export const saveCareRequestClinicalNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { nurseClinicalNotes, checklist, status, etaMinutes } = req.body;
    const updated = await ClinicalService.updateCareRequest(
      id,
      { nurseClinicalNotes, checklist, status, etaMinutes },
      req.user!.id
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const cancelCareRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.careRequest.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!existing) throw new AppError('Care request not found', 404);

    if (req.user!.role === Role.PATIENT && existing.patient.userId !== req.user!.id) {
      throw new AppError('Forbidden: Cannot cancel another patient care request', 403);
    }

    const updated = await ClinicalService.updateCareRequest(
      id,
      { status: 'Cancelled', nurseClinicalNotes: req.body?.reason || existing.nurseClinicalNotes || undefined },
      req.user!.id
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
