import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { 
  getConsultationByAppointment, 
  startConsultation, 
  updateConsultation, 
  completeConsultation 
} from '../controllers/consultation.controller';

const router = Router();

router.use(authenticate);

// GET consultation (by appointment ID)
router.get('/:id', requireRole('DOCTOR', 'PATIENT', 'ADMIN', 'SUPER_ADMIN'), getConsultationByAppointment);

// POST start consultation (by appointment ID)
router.post('/:id/start', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), startConsultation);

// PUT update consultation draft (by consultation ID)
router.put('/:id', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), updateConsultation);

// POST complete consultation (by consultation ID)
router.post('/:id/complete', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), completeConsultation);

export default router;
