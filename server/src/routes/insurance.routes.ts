import { Router } from 'express';
import {
  getPoliciesController,
  getPolicyByIdController,
  createPolicyController,
  updatePolicyController,
  deletePolicyController,
  getClaimsController,
  createClaimController,
  updateClaimStatusController,
  getPreAuthorizationsController,
  createPreAuthorizationController,
  updatePreAuthorizationStatusController,
  getSettlementsController,
  createSettlementController,
  updateSettlementStatusController,
  getDocumentsController,
  addDocumentController,
  updateDocumentStatusController,
  deleteDocumentController,
  getFamilyMembersController,
  addFamilyMemberController,
  deleteFamilyMemberController,
  getPremiumPaymentsController,
  recordPremiumPaymentController,
  getAgentPayoutsController,
  createAgentPayoutController,
  getTpaSettingsController,
  updateTpaSettingsController,
  getNetworkHospitalsController,
} from '../controllers/insurance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);

// Policies
router.get('/policies', getPoliciesController);
router.get('/policies/:id', getPolicyByIdController);
router.post('/policies', createPolicyController);
router.patch('/policies/:id', updatePolicyController);
router.delete('/policies/:id', deletePolicyController);

// Claims
router.get('/claims', getClaimsController);
router.post('/claims', createClaimController);
router.patch('/claims/:id/status', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), updateClaimStatusController);

// Pre-Authorizations
router.get('/preauth', getPreAuthorizationsController);
router.post('/preauth', createPreAuthorizationController);
router.patch('/preauth/:id/status', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), updatePreAuthorizationStatusController);

// Settlements
router.get('/settlements', getSettlementsController);
router.post('/settlements', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), createSettlementController);
router.patch('/settlements/:id/status', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), updateSettlementStatusController);

// Policy Documents, Family Members, Premium Payments
router.get('/documents', getDocumentsController);
router.post('/documents', addDocumentController);
router.patch('/documents/:id/status', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), updateDocumentStatusController);
router.delete('/documents/:id', deleteDocumentController);

router.get('/family-members', getFamilyMembersController);
router.post('/family-members', addFamilyMemberController);
router.delete('/family-members/:id', deleteFamilyMemberController);

router.get('/premium-payments', getPremiumPaymentsController);
router.post('/premium-payments', recordPremiumPaymentController);

// Agent Payouts, TPA Settings & Network Hospitals
router.get('/agent-payouts', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), getAgentPayoutsController);
router.post('/agent-payouts', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), createAgentPayoutController);

router.get('/tpa-settings', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), getTpaSettingsController);
router.put('/tpa-settings', requireRole('INSURANCE_PROVIDER', 'ADMIN', 'SUPER_ADMIN'), updateTpaSettingsController);

router.get('/network-hospitals', getNetworkHospitalsController);

export default router;
