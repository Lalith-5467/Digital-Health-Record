import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireWritePermission } from '../middleware/role.middleware';
import { getVitalsController, createVitalController } from '../controllers/vital.controller';

const router = Router();

router.use(authenticate);

router.get('/', getVitalsController);
router.post('/', requireWritePermission, createVitalController);

export default router;
