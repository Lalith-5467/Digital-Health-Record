import { Router } from 'express';
import { getPatientHealthTopics, assignPatientHealthTopic, removePatientHealthTopic } from '../controllers/patientHealthTopic.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

// All routes require authentication
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

// GET /api/patients/:patientId/health-topics
router.get('/', getPatientHealthTopics);

// POST /api/patients/:patientId/health-topics
router.post('/', assignPatientHealthTopic);

// DELETE /api/patients/:patientId/health-topics/:topicId
router.delete('/:topicId', removePatientHealthTopic);

export default router;
