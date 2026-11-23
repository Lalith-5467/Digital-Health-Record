import { Router, Request } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { CaregiverService } from '../services/caregiver.service';

const router = Router();
router.use(authenticate);

async function resolveAuthorizedPatientId(req: Request): Promise<string | null> {
  const paramId = String(req.params.patientId || '').trim();
  const user = req.user!;

  if (user.role === Role.PATIENT) {
    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) return null;
    if (paramId === 'me' || paramId === patient.id || paramId === user.id || !paramId) {
      return patient.id;
    }
    return null; // Reject cross-patient access
  }

  if (user.role === Role.CAREGIVER) {
    if (!paramId || paramId === 'me') return null;
    try {
      await CaregiverService.validateCaregiverAccess(user.id, user.role, paramId);
      return paramId;
    } catch {
      return null;
    }
  }

  if (user.role === Role.DOCTOR || user.role === Role.NURSE || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    if (paramId === 'me') {
      const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
      return patient?.id || null;
    }
    return paramId || null;
  }

  return null;
}

// Get meals for a patient
router.get('/:patientId/meals', async (req, res) => {
  try {
    const patientId = await resolveAuthorizedPatientId(req);
    if (!patientId) {
      res.status(403).json({ success: false, message: 'Forbidden: Unauthorized patient diet access' });
      return;
    }
    const meals = await prisma.dietMeal.findMany({
      where: { patientId },
      orderBy: { createdAt: 'asc' },
    });

    const formattedMeals = meals.map((m: any) => ({
      ...m,
      days: JSON.parse(m.days || '[]'),
    }));

    res.json(formattedMeals);
  } catch (error) {
    console.error('Failed to fetch meals:', error);
    res.status(500).json({ error: 'Failed to fetch meals' });
  }
});

// Create a meal
router.post('/:patientId/meals', async (req, res) => {
  try {
    const patientId = await resolveAuthorizedPatientId(req);
    if (!patientId) {
      res.status(403).json({ success: false, message: 'Forbidden: Unauthorized patient diet access' });
      return;
    }
    const { type, name, time, portion, cal, pro, carbs, fat, days } = req.body;

    const newMeal = await prisma.dietMeal.create({
      data: {
        patientId,
        type,
        name,
        time,
        portion,
        cal: Number(cal) || 0,
        pro: Number(pro) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        days: JSON.stringify(days || []),
      },
    });

    res.json({ ...newMeal, days: JSON.parse(newMeal.days) });
  } catch (error) {
    console.error('Failed to create meal:', error);
    res.status(500).json({ error: 'Failed to create meal' });
  }
});

// Update a meal
router.put('/:patientId/meals/:mealId', async (req, res) => {
  try {
    const patientId = await resolveAuthorizedPatientId(req);
    if (!patientId) {
      res.status(403).json({ success: false, message: 'Forbidden: Unauthorized patient diet access' });
      return;
    }
    const mealId = String(req.params.mealId);
    const existing = await prisma.dietMeal.findFirst({ where: { id: mealId, patientId } });
    if (!existing) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }
    const { type, name, time, portion, cal, pro, carbs, fat, days } = req.body;

    const updatedMeal = await prisma.dietMeal.update({
      where: { id: mealId },
      data: {
        type,
        name,
        time,
        portion,
        cal: Number(cal) || 0,
        pro: Number(pro) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        days: JSON.stringify(days || []),
      },
    });

    res.json({ ...updatedMeal, days: JSON.parse(updatedMeal.days) });
  } catch (error) {
    console.error('Failed to update meal:', error);
    res.status(500).json({ error: 'Failed to update meal' });
  }
});

// Delete a meal
router.delete('/:patientId/meals/:mealId', async (req, res) => {
  try {
    const patientId = await resolveAuthorizedPatientId(req);
    if (!patientId) {
      res.status(403).json({ success: false, message: 'Forbidden: Unauthorized patient diet access' });
      return;
    }
    const mealId = String(req.params.mealId);
    const existing = await prisma.dietMeal.findFirst({ where: { id: mealId, patientId } });
    if (!existing) {
      res.status(404).json({ error: 'Meal not found' });
      return;
    }
    await prisma.dietMeal.delete({ where: { id: mealId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete meal:', error);
    res.status(500).json({ error: 'Failed to delete meal' });
  }
});

export default router;
