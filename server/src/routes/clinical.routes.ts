import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getDoctorPatientsController,
  getNurseCareRequestsController,
  getPatientCareRequestsController,
  createNurseCareRequestController,
  updateCareRequestController,
} from '../controllers/clinical.controller';

const router = Router();

router.use(authenticate);

router.get('/doctor-patients', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), getDoctorPatientsController);
router.get('/nurse-care-requests', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), getNurseCareRequestsController);
router.get('/my-care-requests', requireRole('PATIENT', 'CAREGIVER', 'ADMIN', 'SUPER_ADMIN'), getPatientCareRequestsController);
router.post('/nurse-care-requests', requireRole('PATIENT', 'CAREGIVER', 'ADMIN', 'SUPER_ADMIN'), createNurseCareRequestController);
router.patch('/nurse-care-requests/:id', requireRole('NURSE', 'PATIENT', 'CAREGIVER', 'ADMIN', 'SUPER_ADMIN'), updateCareRequestController);

export default router;

