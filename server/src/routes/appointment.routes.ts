import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAppointmentsController,
  getAppointmentByIdController,
  createAppointmentController,
  updateAppointmentController,
  cancelAppointmentController,
  getTodaySchedule,
  getDoctorsDirectoryController,
  getDoctorSlotsController,
} from '../controllers/appointment.controller';

const router = Router();

router.use(authenticate);

// Router-level guard: View-only accounts (secondary Super Admin) cannot schedule, modify or cancel appointments
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user?.isViewOnly) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: View-only Super Administrator clearance cannot schedule, modify or cancel appointments',
    });
  }
  next();
});

router.get('/doctors', getDoctorsDirectoryController);
router.get('/doctors/:doctorId/slots', getDoctorSlotsController);
router.get('/schedule', getTodaySchedule);
router.get('/', getAppointmentsController);
router.get('/:id', getAppointmentByIdController);
router.post('/', createAppointmentController);
router.patch('/:id', updateAppointmentController);
router.patch('/:id/cancel', cancelAppointmentController);
router.post('/:id/cancel', cancelAppointmentController);
router.delete('/:id', cancelAppointmentController);

export default router;
