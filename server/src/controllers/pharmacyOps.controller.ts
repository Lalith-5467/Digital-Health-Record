import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from '../services/audit.service';

async function resolvePharmacyContext(req: Request): Promise<{ pharmacyId: string; pharmacistId?: string }> {
  const user = req.user!;
  if (user.role === Role.PHARMACIST) {
    const pharm = await prisma.pharmacist.findUnique({
      where: { userId: user.id },
      include: { hospitalRef: true, pharmacy: true },
    });
    if (pharm?.pharmacyId) {
      return { pharmacyId: pharm.pharmacyId, pharmacistId: pharm.id };
    }
    // Auto-link fallback if pharmacyId was null
    if (pharm) {
      let matchedPharmacy = null;
      if (pharm.hospitalId) {
        matchedPharmacy = await prisma.pharmacy.findFirst({
          where: {
            OR: [
              { name: { contains: pharm.hospitalRef?.name || '' } },
              { name: { contains: pharm.pharmacyName || '' } }
            ]
          }
        });
      }
      if (!matchedPharmacy) {
        matchedPharmacy = await prisma.pharmacy.findFirst({ where: { isActive: true } });
      }
      if (matchedPharmacy) {
        await prisma.pharmacist.update({
          where: { id: pharm.id },
          data: { pharmacyId: matchedPharmacy.id }
        }).catch(() => {});
        return { pharmacyId: matchedPharmacy.id, pharmacistId: pharm.id };
      }
    }
    throw new AppError('Pharmacist is not linked to an active pharmacy', 404);
  }
  const explicitPharmacyId =
    (typeof req.query.pharmacyId === 'string' && req.query.pharmacyId) ||
    (req.body?.pharmacyId && String(req.body.pharmacyId)) ||
    undefined;
  if (explicitPharmacyId) return { pharmacyId: explicitPharmacyId };
  const first = await prisma.pharmacy.findFirst({ where: { isActive: true } });
  if (!first) throw new AppError('No pharmacy found', 404);
  return { pharmacyId: first.id };
}

// ==========================================
// 1. PHARMACY-SCOPED INVENTORY
// ==========================================
export const getPharmacyInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const items = await prisma.pharmacyInventory.findMany({
      where: {
        pharmacyId,
        ...(search
          ? {
              OR: [
                { medicineName: { contains: search } },
                { genericName: { contains: search } },
                { category: { contains: search } },
                { batchNumber: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { medicineName: 'asc' },
    });
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
};

export const upsertPharmacyInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const {
      medicineId,
      medicineName,
      genericName,
      category,
      dosage,
      batchNumber,
      stockQuantity,
      reorderLevel,
      unitPrice,
      mrp,
      gstRate,
      scheduleCategory,
      expiryDate,
      manufacturer,
    } = req.body;

    if (!medicineName || !String(medicineName).trim()) {
      throw new AppError('medicineName is required', 400);
    }

    const batch = (batchNumber || 'BATCH-STD').trim();
    const name = String(medicineName).trim();

    const item = await prisma.pharmacyInventory.upsert({
      where: {
        pharmacyId_medicineName_batchNumber: {
          pharmacyId,
          medicineName: name,
          batchNumber: batch,
        },
      },
      create: {
        pharmacyId,
        medicineId: medicineId || null,
        medicineName: name,
        genericName: genericName || null,
        category: category || 'General',
        dosage: dosage || null,
        batchNumber: batch,
        stockQuantity: Number(stockQuantity ?? 0),
        reorderLevel: Number(reorderLevel ?? 15),
        unitPrice: Number(unitPrice ?? mrp ?? 0),
        mrp: Number(mrp ?? unitPrice ?? 0),
        gstRate: Number(gstRate ?? 12),
        scheduleCategory: scheduleCategory || 'OTC',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturer: manufacturer || null,
      },
      update: {
        ...(genericName !== undefined ? { genericName } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(dosage !== undefined ? { dosage } : {}),
        ...(stockQuantity !== undefined ? { stockQuantity: Number(stockQuantity) } : {}),
        ...(reorderLevel !== undefined ? { reorderLevel: Number(reorderLevel) } : {}),
        ...(unitPrice !== undefined ? { unitPrice: Number(unitPrice) } : {}),
        ...(mrp !== undefined ? { mrp: Number(mrp) } : {}),
        ...(gstRate !== undefined ? { gstRate: Number(gstRate) } : {}),
        ...(scheduleCategory !== undefined ? { scheduleCategory } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
        ...(manufacturer !== undefined ? { manufacturer } : {}),
      },
    });

    await AuditService.log({
      userId: req.user!.id,
      action: 'PHARMACY_INVENTORY_UPDATED',
      entityType: 'pharmacy_inventory',
      entityId: item.id,
      ipAddress: req.ip,
      details: { medicineName: item.medicineName, stockQuantity: item.stockQuantity },
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

export const updatePharmacyInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const existing = await prisma.pharmacyInventory.findFirst({
      where: { id: String(req.params.id), pharmacyId },
    });
    if (!existing) throw new AppError('Inventory item not found', 404);

    const { stockQuantity, stockDelta, reorderLevel, unitPrice, mrp, gstRate, scheduleCategory, expiryDate } = req.body;
    const nextQty =
      stockDelta !== undefined
        ? Math.max(0, existing.stockQuantity + Number(stockDelta))
        : stockQuantity !== undefined
        ? Math.max(0, Number(stockQuantity))
        : existing.stockQuantity;

    const updated = await prisma.pharmacyInventory.update({
      where: { id: existing.id },
      data: {
        stockQuantity: nextQty,
        ...(reorderLevel !== undefined ? { reorderLevel: Number(reorderLevel) } : {}),
        ...(unitPrice !== undefined ? { unitPrice: Number(unitPrice) } : {}),
        ...(mrp !== undefined ? { mrp: Number(mrp) } : {}),
        ...(gstRate !== undefined ? { gstRate: Number(gstRate) } : {}),
        ...(scheduleCategory !== undefined ? { scheduleCategory } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
      },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deletePharmacyInventoryItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const existing = await prisma.pharmacyInventory.findFirst({
      where: { id: String(req.params.id), pharmacyId },
    });
    if (!existing) throw new AppError('Inventory item not found', 404);
    await prisma.pharmacyInventory.delete({ where: { id: existing.id } });
    res.status(200).json({ success: true, message: 'Inventory item removed' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. PHARMACY GST INVOICES
// ==========================================
export const getPharmacyInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const invoices = await prisma.pharmacyInvoice.findMany({
      where: { pharmacyId },
      include: {
        patient: { select: { id: true, fullName: true } },
        order: { include: { items: true, payments: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
    res.status(200).json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
};

export const generateOrderInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const orderId = String(req.params.orderId);
    const order = await prisma.pharmacyOrder.findFirst({
      where: { id: orderId, pharmacyId },
      include: { items: true, pharmacy: true },
    });
    if (!order) throw new AppError('Pharmacy order not found', 404);

    const existing = await prisma.pharmacyInvoice.findUnique({ where: { orderId: order.id } });
    if (existing) {
      return res.status(200).json({ success: true, data: existing });
    }

    const subtotal = Number(order.totalAmount || 0);
    const taxRate = Number(req.body?.gstRate ?? 12);
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const deliveryFee = Number(order.deliveryFee || 0);
    const discountAmount = Number(req.body?.discountAmount || 0);
    const grandTotal = Math.max(0, Number((subtotal + taxAmount + deliveryFee - discountAmount).toFixed(2)));

    const invoice = await prisma.pharmacyInvoice.create({
      data: {
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}-${order.id.slice(-4).toUpperCase()}`,
        orderId: order.id,
        pharmacyId,
        patientId: order.patientId,
        subtotal,
        taxAmount,
        deliveryFee,
        discountAmount,
        grandTotal,
        gstin: order.pharmacy?.gstin || null,
        hsnBreakdownJson: JSON.stringify(
          order.items.map((it) => ({
            medicineName: it.medicineName,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            subtotal: Number(it.subtotal),
            gstRate: taxRate,
          }))
        ),
      },
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. SUPPLIER PURCHASE ORDERS (WITH INWARD STOCK SYNC)
// ==========================================
export const getSupplierOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const orders = await prisma.supplierOrder.findMany({
      where: { pharmacyId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

export const createSupplierOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const { supplierName, supplierLicense, expectedDate, notes, items } = req.body;
    if (!supplierName || !String(supplierName).trim()) {
      throw new AppError('supplierName is required', 400);
    }

    const parsedItems: Array<any> = Array.isArray(items) ? items : [];
    const totalAmount = parsedItems.reduce(
      (sum, it) => sum + Number(it.quantity || 1) * Number(it.unitCost || 0),
      0
    );

    const created = await prisma.supplierOrder.create({
      data: {
        poNumber: `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
        pharmacyId,
        supplierName: String(supplierName).trim(),
        supplierLicense: supplierLicense || null,
        totalAmount: req.body.totalAmount != null ? Number(req.body.totalAmount) : totalAmount,
        status: 'Pending',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes || null,
        items: {
          create: parsedItems.map((it) => ({
            medicineId: it.medicineId || null,
            medicineName: String(it.medicineName || 'Medicine'),
            batchNumber: it.batchNumber || `BATCH-${Date.now().toString().slice(-4)}`,
            quantity: Number(it.quantity || 1),
            unitCost: Number(it.unitCost || 0),
            subtotal: Number(it.quantity || 1) * Number(it.unitCost || 0),
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const updateSupplierOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const existing = await prisma.supplierOrder.findFirst({
      where: { id: String(req.params.id), pharmacyId },
      include: { items: true },
    });
    if (!existing) throw new AppError('Supplier order not found', 404);

    const nextStatus = String(req.body.status || 'Received');
    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.supplierOrder.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'Received' && !existing.receivedAt ? { receivedAt: new Date() } : {}),
        },
        include: { items: true },
      });

      // Automatically restock pharmacy_inventory when PO transitions to Received
      if (nextStatus === 'Received' && existing.status !== 'Received') {
        for (const item of existing.items) {
          const batch = item.batchNumber || 'BATCH-PO';
          await tx.pharmacyInventory.upsert({
            where: {
              pharmacyId_medicineName_batchNumber: {
                pharmacyId,
                medicineName: item.medicineName,
                batchNumber: batch,
              },
            },
            create: {
              pharmacyId,
              medicineId: item.medicineId,
              medicineName: item.medicineName,
              batchNumber: batch,
              stockQuantity: item.quantity,
              unitPrice: item.unitCost,
              mrp: item.unitCost,
            },
            update: {
              stockQuantity: { increment: item.quantity },
            },
          });
        }
      }
      return po;
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. SCHEDULE H / H1 / X AUDIT REGISTER
// ==========================================
export const getScheduleDrugLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId } = await resolvePharmacyContext(req);
    const logs = await prisma.scheduleDrugLog.findMany({
      where: { pharmacyId },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, fullName: true, licenseNumber: true } },
        pharmacist: { select: { id: true, fullName: true, licenseNumber: true } },
      },
      orderBy: { dispensedAt: 'desc' },
    });
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

export const createScheduleDrugLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pharmacyId, pharmacistId } = await resolvePharmacyContext(req);
    const { orderId, prescriptionId, patientId, doctorId, medicineName, scheduleClass, batchNumber, quantityDispensed, notes } = req.body;
    if (!patientId || !medicineName) {
      throw new AppError('patientId and medicineName are required', 400);
    }

    const log = await prisma.scheduleDrugLog.create({
      data: {
        logCode: `SCH-${Date.now().toString().slice(-6)}`,
        pharmacyId,
        orderId: orderId || null,
        prescriptionId: prescriptionId || null,
        patientId,
        doctorId: doctorId || null,
        pharmacistId: pharmacistId || null,
        medicineName: String(medicineName).trim(),
        scheduleClass: scheduleClass || 'Schedule H1',
        batchNumber: batchNumber || null,
        quantityDispensed: Number(quantityDispensed || 1),
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. DRUG INTERACTIONS DATABASE
// ==========================================
export const getDrugInteractions = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.drugInteraction.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const checkDrugInteractions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drugs: string[] = Array.isArray(req.body?.drugs)
      ? req.body.drugs.map((d: any) => String(d).trim()).filter(Boolean)
      : [];
    if (drugs.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    const allInteractions = await prisma.drugInteraction.findMany();
    const lowerDrugs = drugs.map((d) => d.toLowerCase());
    const matches = allInteractions.filter((row) => {
      const a = row.drugA.toLowerCase();
      const b = row.drugB.toLowerCase();
      const hasA = lowerDrugs.some((d) => d.includes(a) || a.includes(d));
      const hasB = lowerDrugs.some((d) => d.includes(b) || b.includes(d));
      return hasA && hasB;
    });

    res.status(200).json({ success: true, data: matches });
  } catch (err) {
    next(err);
  }
};

export const createDrugInteraction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { drugA, drugB, severity, mechanism, clinicalEffect, recommendation } = req.body;
    if (!drugA || !drugB || !clinicalEffect || !recommendation) {
      throw new AppError('drugA, drugB, clinicalEffect, and recommendation are required', 400);
    }
    const created = await prisma.drugInteraction.upsert({
      where: { drugA_drugB: { drugA: drugA.trim(), drugB: drugB.trim() } },
      create: {
        drugA: drugA.trim(),
        drugB: drugB.trim(),
        severity: severity || 'Moderate',
        mechanism: mechanism || null,
        clinicalEffect: clinicalEffect.trim(),
        recommendation: recommendation.trim(),
      },
      update: {
        severity: severity || 'Moderate',
        mechanism: mechanism || null,
        clinicalEffect: clinicalEffect.trim(),
        recommendation: recommendation.trim(),
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

async function assertOrderMessageAccess(orderId: string, userId: string, role: string) {
  const order = await prisma.pharmacyOrder.findUnique({
    where: { id: orderId },
    include: { patient: { select: { id: true, userId: true } } },
  });
  if (!order) throw new AppError('Pharmacy order not found', 404);

  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return order;
  if (r === 'PATIENT' && order.patient.userId === userId) return order;
  if (r === 'PHARMACIST') {
    const pharmacist = await prisma.pharmacist.findUnique({ where: { userId }, select: { pharmacyId: true } });
    if (pharmacist?.pharmacyId && order.pharmacyId === pharmacist.pharmacyId) return order;
    throw new AppError('Forbidden: Order belongs to a different pharmacy', 403);
  }
  if (r === 'CAREGIVER') {
    const { CaregiverService } = await import('../services/caregiver.service');
    await CaregiverService.validateCaregiverAccess(userId, 'CAREGIVER' as any, order.patientId);
    return order;
  }
  throw new AppError('Forbidden: You do not have access to this order conversation', 403);
}

// ==========================================
// 6. PATIENT <-> PHARMACIST ORDER MESSAGES
// ==========================================
export const getOrderMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = String(req.params.orderId);
    await assertOrderMessageAccess(orderId, req.user!.id, String(req.user!.role));
    const messages = await prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export const postOrderMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = String(req.params.orderId);
    await assertOrderMessageAccess(orderId, req.user!.id, String(req.user!.role));
    const { text } = req.body;
    if (!text || !String(text).trim()) throw new AppError('Message text is required', 400);

    const created = await prisma.orderMessage.create({
      data: {
        orderId,
        senderUserId: req.user!.id,
        senderRole: String(req.user!.role),
        text: String(text).trim(),
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};
