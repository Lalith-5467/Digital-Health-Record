import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAllergies,
  createAllergy,
  deleteAllergy,
  getConditions,
  createCondition,
  deleteCondition,
  getSurgeries,
  createSurgery,
  deleteSurgery,
  getWellnessLogs,
  createWellnessLog,
  getEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  getSosAlerts,
  triggerSosAlert,
  resolveSosAlert,
  getHealthGoals,
  createHealthGoal,
  updateHealthGoal,
  deleteHealthGoal,
  getAnalyticsSummary,
  getCheckups,
  saveCheckup,
  deleteCheckup,
} from '../controllers/patientClinical.controller';

const router = Router();
router.use(authenticate);
router.use((req, res, next) => {
  const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (req.user?.isViewOnly && isMutatingMethod) {
    res.status(403).json({
      success: false,
      message: 'Access denied: View-only Super Administrator clearance cannot execute write, delete, or modification operations.',
    });
    return;
  }
  next();
});

// Allergies
router.get('/allergies', getAllergies);
router.post('/allergies', createAllergy);
router.delete('/allergies/:id', deleteAllergy);

// Chronic Conditions
router.get('/conditions', getConditions);
router.post('/conditions', createCondition);
router.delete('/conditions/:id', deleteCondition);

// Surgeries
router.get('/surgeries', getSurgeries);
router.post('/surgeries', createSurgery);
router.delete('/surgeries/:id', deleteSurgery);

// Wellness Logs
router.get('/wellness', getWellnessLogs);
router.post('/wellness', createWellnessLog);

// Emergency Contacts & SOS
router.get('/emergency/contacts', getEmergencyContacts);
router.post('/emergency/contacts', createEmergencyContact);
router.put('/emergency/contacts/:id', updateEmergencyContact);
router.delete('/emergency/contacts/:id', deleteEmergencyContact);
router.get('/emergency/sos', getSosAlerts);
router.post('/emergency/sos', triggerSosAlert);
router.patch('/emergency/sos/:id/resolve', resolveSosAlert);

// Health Goals & Analytics Summary
router.get('/analytics/goals', getHealthGoals);
router.post('/analytics/goals', createHealthGoal);
router.patch('/analytics/goals/:id', updateHealthGoal);
router.delete('/analytics/goals/:id', deleteHealthGoal);
router.get('/analytics/summary', getAnalyticsSummary);

// Health Checkups
router.get('/checkups', getCheckups);
router.post('/checkups', saveCheckup);
router.delete('/checkups/:id', deleteCheckup);

export default router;

