import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getNurseInventory,
  createNurseInventoryItem,
  updateNurseInventoryItem,
  deleteNurseInventoryItem,
  getNurseRestockRequests,
  createNurseRestockRequest,
  updateNurseRestockRequest,
  getClinicalAlerts,
  createClinicalAlert,
  updateClinicalAlertStatus,
  saveCareRequestClinicalNotes,
  cancelCareRequest,
} from '../controllers/nurseOps.controller';

const router = Router();
router.use(authenticate);

// Inventory
router.get('/inventory', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), getNurseInventory);
router.post('/inventory', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), createNurseInventoryItem);
router.patch('/inventory/:id', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), updateNurseInventoryItem);
router.delete('/inventory/:id', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), deleteNurseInventoryItem);

// Restock Requests
router.get('/restock-requests', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), getNurseRestockRequests);
router.post('/restock-requests', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), createNurseRestockRequest);
router.patch('/restock-requests/:id', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), updateNurseRestockRequest);

// Clinical Alerts
router.get('/alerts', requireRole('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'), getClinicalAlerts);
router.post('/alerts', requireRole('NURSE', 'DOCTOR', 'CAREGIVER', 'ADMIN', 'SUPER_ADMIN'), createClinicalAlert);
router.patch('/alerts/:id/status', requireRole('NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'), updateClinicalAlertStatus);

// Care Request Notes, Checklist & Cancellation
router.patch('/care-requests/:id/notes', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), saveCareRequestClinicalNotes);
router.patch('/care-requests/:id/cancel', requireRole('PATIENT', 'CAREGIVER', 'NURSE', 'ADMIN', 'SUPER_ADMIN'), cancelCareRequest);

export default router;
