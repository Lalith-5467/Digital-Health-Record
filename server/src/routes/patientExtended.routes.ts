import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getFamilyConnections,
  createFamilyConnection,
  updateFamilyConnection,
  deleteFamilyConnection,
  getFamilyMessages,
  postFamilyMessage,
  createFamilySharedItem,
  getPatientHospitals,
  toggleSaveHospital,
  createHospitalReview,
  getLabTestBookings,
  createLabTestBooking,
  updateLabTestBooking,
  deleteLabTestBooking,
  getSanitationBookings,
  createSanitationBooking,
  updateSanitationBooking,
  getReportInsights,
  createReportInsight,
  updateReportInsight,
  getDietAssessment,
  saveDietAssessment,
  getAiConversations,
  createAiConversation,
  postAiMessage,
  deleteAiConversation,
  getSavedHealthNotes,
  createSavedHealthNote,
  deleteSavedHealthNote,
} from '../controllers/patientExtended.controller';

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

// Family Connect
router.get('/family', getFamilyConnections);
router.post('/family', createFamilyConnection);
router.patch('/family/:id', updateFamilyConnection);
router.delete('/family/:id', deleteFamilyConnection);
router.get('/family/:connectionId/messages', getFamilyMessages);
router.post('/family/:connectionId/messages', postFamilyMessage);
router.post('/family/shared', createFamilySharedItem);

// Hospitals & Reviews
router.get('/hospitals', getPatientHospitals);
router.post('/hospitals/:hospitalId/save', toggleSaveHospital);
router.post('/hospitals/:hospitalId/reviews', createHospitalReview);

// Lab Tests
router.get('/lab-tests', getLabTestBookings);
router.post('/lab-tests', createLabTestBooking);
router.patch('/lab-tests/:id', updateLabTestBooking);
router.delete('/lab-tests/:id', deleteLabTestBooking);

// Home Sanitation
router.get('/sanitation', getSanitationBookings);
router.post('/sanitation', createSanitationBooking);
router.patch('/sanitation/:id', updateSanitationBooking);

// Report Insights
router.get('/report-insights', getReportInsights);
router.post('/report-insights', createReportInsight);
router.patch('/report-insights/:id', updateReportInsight);

// Diet Assessment
router.get('/diet-assessment', getDietAssessment);
router.put('/diet-assessment', saveDietAssessment);

// AI Assistant & Saved Notes
router.get('/ai/conversations', getAiConversations);
router.post('/ai/conversations', createAiConversation);
router.post('/ai/conversations/:id/messages', postAiMessage);
router.delete('/ai/conversations/:id', deleteAiConversation);
router.get('/ai/notes', getSavedHealthNotes);
router.post('/ai/notes', createSavedHealthNote);
router.delete('/ai/notes/:id', deleteSavedHealthNote);

export default router;
