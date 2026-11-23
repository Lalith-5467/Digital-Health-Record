import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getDashboardData } from '../controllers/doctorDashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), getDashboardData);

export default router;
