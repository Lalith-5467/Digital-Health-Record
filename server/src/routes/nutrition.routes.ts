import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { searchFood, getFoodDetails } from '../controllers/nutrition.controller';

const router = Router();

router.use(authenticate);
router.get('/search', searchFood);
router.post('/details', getFoodDetails);

export default router;
