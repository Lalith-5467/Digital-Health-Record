import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getPharmacyInventory,
  upsertPharmacyInventoryItem,
  updatePharmacyInventoryItem,
  deletePharmacyInventoryItem,
  getPharmacyInvoices,
  generateOrderInvoice,
  getSupplierOrders,
  createSupplierOrder,
  updateSupplierOrderStatus,
  getScheduleDrugLogs,
  createScheduleDrugLog,
  getDrugInteractions,
  checkDrugInteractions,
  createDrugInteraction,
  getOrderMessages,
  postOrderMessage,
} from '../controllers/pharmacyOps.controller';

const router = Router();
router.use(authenticate);

// Inventory
router.get('/inventory', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN', 'PATIENT'), getPharmacyInventory);
router.post('/inventory', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), upsertPharmacyInventoryItem);
router.patch('/inventory/:id', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), updatePharmacyInventoryItem);
router.delete('/inventory/:id', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), deletePharmacyInventoryItem);

// Billing / GST Invoices
router.get('/invoices', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), getPharmacyInvoices);
router.post('/invoices/:orderId', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), generateOrderInvoice);

// Supplier POs
router.get('/supplier-orders', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), getSupplierOrders);
router.post('/supplier-orders', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), createSupplierOrder);
router.patch('/supplier-orders/:id/status', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), updateSupplierOrderStatus);

// Schedule H / H1 / X Audit
router.get('/schedule-audit', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), getScheduleDrugLogs);
router.post('/schedule-audit', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), createScheduleDrugLog);

// Drug Interactions
router.get('/drug-interactions', getDrugInteractions);
router.post('/drug-interactions/check', checkDrugInteractions);
router.post('/drug-interactions', requireRole('PHARMACIST', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'), createDrugInteraction);

// Patient <-> Pharmacist Order Chat
router.get('/orders/:orderId/messages', getOrderMessages);
router.post('/orders/:orderId/messages', postOrderMessage);

export default router;
