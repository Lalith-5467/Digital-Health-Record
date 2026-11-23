import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMedicinesController,
  getActiveMedicationsController,
  getAdherenceTrendsController,
  getDoseHistoryController,
  createPatientMedicationController,
  recordDoseLogController,
  updatePatientMedicationController,
  deletePatientMedicationController,
  createMedicineController,
} from '../controllers/medicine.controller';

const router = Router();

router.use(authenticate);

router.get('/', getMedicinesController);
router.get('/active', getActiveMedicationsController);
router.get('/adherence', getAdherenceTrendsController);
router.get('/dose-history', getDoseHistoryController);
router.post('/patient-meds', createPatientMedicationController);
router.patch('/patient-meds/:id', updatePatientMedicationController);
router.delete('/patient-meds/:id', deletePatientMedicationController);
router.post('/dose-log', recordDoseLogController);
router.post('/', createMedicineController);

export default router;
