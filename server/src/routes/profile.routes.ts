import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getCurrentUserProfile,
  getPatientProfile,
  updatePatientProfile,
  getDoctorProfile,
  updateDoctorProfile,
  getNurseProfile,
  updateNurseProfile,
  getPharmacistProfile,
  updatePharmacistProfile,
  getCaregiverProfile,
  updateCaregiverProfile,
  getInsuranceProfile,
  updateInsuranceProfile,
  getUserPreferences,
  updateUserPreferences,
  updateAdminAccountProfile,
  patchCurrentUserProfile,
  updateDoctorAvailability,
} from '../controllers/profile.controller';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// 1. Current user generic profile & preferences
router.get('/', getCurrentUserProfile);
router.get('/me', getCurrentUserProfile);
router.patch('/', patchCurrentUserProfile);
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);
router.put('/admin', requireRole('ADMIN', 'SUPER_ADMIN'), updateAdminAccountProfile);

// 2. Patient Profile (accessible by Patient, Doctor, Nurse, Caregiver, Pharmacist, Insurance, Admin)
router.get(
  '/patient',
  requireRole('PATIENT', 'DOCTOR', 'NURSE', 'CAREGIVER', 'PHARMACIST', 'INSURANCE_PROVIDER', 'INSURANCE', 'ADMIN', 'SUPER_ADMIN'),
  getPatientProfile
);
router.put('/patient', requireRole('PATIENT', 'ADMIN', 'SUPER_ADMIN'), updatePatientProfile);

// 3. Doctor Profile (accessible by Doctor, Patient, Nurse, Admin, Super Admin)
router.get(
  '/doctor',
  requireRole('DOCTOR', 'PATIENT', 'NURSE', 'CAREGIVER', 'PHARMACIST', 'ADMIN', 'SUPER_ADMIN'),
  getDoctorProfile
);
router.put('/doctor', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), updateDoctorProfile);
router.put('/doctor/availability', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), updateDoctorAvailability);

// 4. Nurse Profile
router.get(
  '/nurse',
  requireRole('NURSE', 'DOCTOR', 'PATIENT', 'ADMIN', 'SUPER_ADMIN'),
  getNurseProfile
);
router.put('/nurse', requireRole('NURSE', 'ADMIN', 'SUPER_ADMIN'), updateNurseProfile);

// 5. Pharmacist Profile
router.get(
  '/pharmacist',
  requireRole('PHARMACIST', 'DOCTOR', 'PATIENT', 'ADMIN', 'SUPER_ADMIN'),
  getPharmacistProfile
);
router.put('/pharmacist', requireRole('PHARMACIST', 'ADMIN', 'SUPER_ADMIN'), updatePharmacistProfile);

// 6. Caregiver Profile
router.get(
  '/caregiver',
  requireRole('CAREGIVER', 'PATIENT', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  getCaregiverProfile
);
router.put('/caregiver', requireRole('CAREGIVER', 'ADMIN', 'SUPER_ADMIN'), updateCaregiverProfile);

// 7. Insurance Provider Profile
router.get(
  '/insurance',
  requireRole('INSURANCE_PROVIDER', 'INSURANCE', 'PATIENT', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'),
  getInsuranceProfile
);
router.put(
  '/insurance',
  requireRole('INSURANCE_PROVIDER', 'INSURANCE', 'ADMIN', 'SUPER_ADMIN'),
  updateInsuranceProfile
);

export default router;
