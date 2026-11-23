import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
  clearAllNotificationsController,
  generateSpeechController,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

// Speech generation endpoint (authenticated utility for voice notifications)
router.post('/speech', generateSpeechController);

router.get('/', getNotificationsController);
router.patch('/read-all', markAllNotificationsReadController);
router.patch('/:id/read', markNotificationReadController);
router.delete('/clear-all', clearAllNotificationsController);
router.delete('/', clearAllNotificationsController);
router.delete('/:id', deleteNotificationController);

export default router;
