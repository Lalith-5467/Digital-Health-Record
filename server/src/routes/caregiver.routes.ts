import { Router } from 'express';
import {
  getWardsController,
  getWardRecordsController,
  getTasksController,
  createTaskController,
  updateTaskController,
  deleteTaskController,
  logVitalController,
  getWardNotesController,
  createWardNoteController,
  updatePatientLocationController,
  getCareCircleController,
  addCareCircleMemberController,
  removeCareCircleMemberController,
  toggleConsentStatusController,
  addDependentController,
  removeDependentController,
} from '../controllers/caregiver.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/wards', getWardsController);
router.get('/ward-records/:patientId', getWardRecordsController);
router.post('/dependents', addDependentController);
router.delete('/dependents/:patientId', removeDependentController);
router.get('/tasks', getTasksController);
router.post('/tasks', createTaskController);
router.patch('/tasks/:id', updateTaskController);
router.delete('/tasks/:id', deleteTaskController);
router.post('/vitals', logVitalController);
router.get('/ward-notes', getWardNotesController);
router.post('/ward-notes', createWardNoteController);
router.patch('/location', updatePatientLocationController);

router.get('/care-circle', getCareCircleController);
router.post('/care-circle/members', addCareCircleMemberController);
router.delete('/care-circle/members/:targetCaregiverId', removeCareCircleMemberController);
router.patch('/consent/status', toggleConsentStatusController);

export default router;
