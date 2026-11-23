import { Request, Response, NextFunction } from 'express';
import { InsuranceService } from '../services/insurance.service';

export const getPoliciesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = req.query.search as string;
    const data = await InsuranceService.getPolicies(req.user!.id, req.user!.role, search);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPolicyByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.getPolicyById(id, req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createPolicyController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.createPolicy(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, message: 'Insurance policy registered successfully', data });
  } catch (error) {
    next(error);
  }
};

export const updatePolicyController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.updatePolicy(req.user!.id, req.user!.role, id, req.body);
    res.status(200).json({ success: true, message: 'Insurance policy updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const deletePolicyController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.deletePolicy(req.user!.id, req.user!.role, id);
    res.status(200).json({ success: true, message: 'Insurance policy deleted', data });
  } catch (error) {
    next(error);
  }
};

export const getClaimsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status as string;
    const data = await InsuranceService.getClaims(req.user!.id, req.user!.role, status);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createClaimController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.createClaim(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, message: 'Claim filed successfully', data });
  } catch (error) {
    next(error);
  }
};

export const updateClaimStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status, approvedAmount, reason } = req.body;
    const data = await InsuranceService.updateClaimStatus(id, status, approvedAmount, reason, req.user!.id, req.user!.role);
    res.status(200).json({ success: true, message: 'Claim status updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const getPreAuthorizationsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getPreAuthorizations(req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createPreAuthorizationController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.createPreAuthorization(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, message: 'Pre-authorization submitted', data });
  } catch (error) {
    next(error);
  }
};

export const updatePreAuthorizationStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.updatePreAuthorizationStatus(req.user!.id, req.user!.role, id, req.body);
    res.status(200).json({ success: true, message: 'Pre-authorization updated', data });
  } catch (error) {
    next(error);
  }
};

export const getSettlementsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getSettlements(req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createSettlementController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.createSettlement(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, message: 'Settlement recorded', data });
  } catch (error) {
    next(error);
  }
};

export const updateSettlementStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.updateSettlementStatus(req.user!.id, req.user!.role, id, req.body);
    res.status(200).json({ success: true, message: 'Settlement updated', data });
  } catch (error) {
    next(error);
  }
};

export const getDocumentsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getDocuments(req.user!.id, req.user!.role, req.query.policyId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const addDocumentController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.addDocument(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateDocumentStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.updateDocumentStatus(req.user!.id, req.user!.role, id, req.body?.status || 'Verified');
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.deleteDocument(req.user!.id, req.user!.role, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getFamilyMembersController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getFamilyMembers(req.user!.id, req.user!.role, req.query.policyId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const addFamilyMemberController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.addFamilyMember(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteFamilyMemberController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InsuranceService.deleteFamilyMember(req.user!.id, req.user!.role, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPremiumPaymentsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getPremiumPayments(req.user!.id, req.user!.role, req.query.policyId as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const recordPremiumPaymentController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.recordPremiumPayment(req.user!.id, req.user!.role, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAgentPayoutsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getAgentPayouts(req.user!.id, req.user!.role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createAgentPayoutController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.createAgentPayout(req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getTpaSettingsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getTpaSettings(req.user!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateTpaSettingsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.updateTpaSettings(req.user!.id, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getNetworkHospitalsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await InsuranceService.getNetworkHospitals(req.query.search as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
