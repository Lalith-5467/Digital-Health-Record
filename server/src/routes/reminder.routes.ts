import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireWritePermission } from '../middleware/role.middleware';
import {
  getRemindersController,
  createReminderController,
  updateReminderController,
  updateFollowUpStatusController,
  deleteReminderController,
} from '../controllers/reminder.controller';

const router = Router();

router.use(authenticate);

router.get('/', getRemindersController);
router.post('/', requireWritePermission, createReminderController);
router.patch('/:id/follow-up', requireWritePermission, updateFollowUpStatusController);
router.patch('/:id', requireWritePermission, updateReminderController);
router.delete('/:id', requireWritePermission, deleteReminderController);

export default router;
