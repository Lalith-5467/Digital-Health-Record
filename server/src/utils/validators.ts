import { z } from 'zod';
import { Role, RecordType, PrescriptionStatus } from '@prisma/client';

export const patientUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  gender: z.string().max(20).optional().nullable(),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  abhaId: z.string().max(50).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(30).optional().nullable(),
  familyPhone: z.string().max(30).optional().nullable(),
  heightCm: z.number().min(20).max(300).optional().nullable(),
  weightKg: z.number().min(1).max(500).optional().nullable(),
  organDonor: z.boolean().optional(),
  preferredHospital: z.string().max(200).optional().nullable(),
  familyDoctor: z.string().max(200).optional().nullable(),
  criticalMedicalNotes: z.string().max(2000).optional().nullable(),
  preferredPharmacyId: z.string().max(100).optional().nullable(),
  preferredDeliveryMethod: z.string().max(50).optional().nullable(),
  geofenceRadiusMeters: z.number().int().min(50).max(50000).optional().nullable(),
  lastKnownLocation: z.string().max(300).optional().nullable(),
});

export const doctorUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  speciality: z.string().min(1).max(100).optional(),
  department: z.string().max(100).optional().nullable(),
  qualification: z.string().max(200).optional().nullable(),
  licenseNumber: z.string().max(100).optional().nullable(),
  hprAddress: z.string().max(150).optional().nullable(),
  hospital: z.string().max(200).optional().nullable(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  consultationFee: z.number().min(0).optional(),
  onlineFee: z.number().min(0).optional().nullable(),
  inPersonFee: z.number().min(0).optional().nullable(),
  consultDurationMin: z.number().int().min(5).max(180).optional(),
  teleConsultReady: z.boolean().optional(),
  emergencyAvailable: z.boolean().optional(),
  languagesJson: z.string().max(1000).optional().nullable(),
  notificationPrefsJson: z.string().max(5000).optional().nullable(),
  photoUrl: z.string().url().or(z.string().max(500)).optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
});

export const nurseUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  hospital: z.string().max(200).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  qualification: z.string().max(200).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  specialtiesJson: z.string().max(2000).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  licenseNumber: z.string().max(100).optional().nullable(),
  stateCouncil: z.string().max(150).optional().nullable(),
  abdmHprId: z.string().max(100).optional().nullable(),
  homeVisitAvailable: z.boolean().optional(),
  shiftStatus: z.string().max(50).optional().nullable(),
});

export const pharmacistUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  pharmacyName: z.string().max(200).optional().nullable(),
  licenseNumber: z.string().max(100).optional().nullable(),
  pciRegistrationNo: z.string().max(100).optional().nullable(),
  pharmacyId: z.string().optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  pharmacyDetails: z
    .object({
      name: z.string().max(200).optional(),
      licenseNumber: z.string().max(100).optional(),
      gstin: z.string().max(50).optional().nullable(),
      pciNumber: z.string().max(100).optional().nullable(),
      operatingHours: z.string().max(200).optional().nullable(),
      address: z.string().max(500).optional().nullable(),
      city: z.string().max(100).optional().nullable(),
      state: z.string().max(100).optional().nullable(),
      pincode: z.string().max(20).optional().nullable(),
      phone: z.string().max(30).optional().nullable(),
      email: z.string().max(150).optional().nullable(),
      deliveryAvailable: z.boolean().optional(),
      pickupAvailable: z.boolean().optional(),
      deliveryFee: z.number().min(0).optional(),
    })
    .optional(),
});

export const caregiverUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  preferredName: z.string().max(100).optional().nullable(),
  relationship: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  caregiverType: z.string().max(100).optional().nullable(),
  govIdNumber: z.string().max(100).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactRelation: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(30).optional().nullable(),
});

export const insuranceUpdateSchema = z.object({
  providerName: z.string().min(1).max(200).optional(),
  licenseNumber: z.string().max(100).optional().nullable(),
  tpaId: z.string().max(100).optional().nullable(),
  contactPerson: z.string().max(150).optional().nullable(),
  officerEmpId: z.string().max(100).optional().nullable(),
  officerDesignation: z.string().max(150).optional().nullable(),
  claimsClearanceLevel: z.string().max(100).optional().nullable(),
  officeAddress: z.string().max(500).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  supportPhone: z.string().max(30).optional().nullable(),
  supportEmail: z.string().email().optional().nullable(),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).or(z.boolean()),
});

export const roleUpdateSchema = z.object({
  role: z.nativeEnum(Role),
});

// ==========================================
// MEDICAL RECORD VALIDATION SCHEMAS
// ==========================================
export const createMedicalRecordSchema = z.object({
  patientId: z.string().optional(),
  title: z.string().min(1, 'title is required').max(200),
  type: z.nativeEnum(RecordType).optional(),
  hospital: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  isImportant: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
  recordDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  fileUrl: z.string().url().or(z.string().max(500)).optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.string().max(50).optional(),
});

export const updateMedicalRecordSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(RecordType).optional(),
  hospital: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  isImportant: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
  recordDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  fileUrl: z.string().url().or(z.string().max(500)).optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.string().max(50).optional(),
});

// ==========================================
// PRESCRIPTION VALIDATION SCHEMAS
// ==========================================
export const prescriptionItemInputSchema = z.object({
  medicineId: z.string().optional(),
  medicineName: z.string().min(1, 'medicineName is required').max(200),
  dosage: z.string().min(1, 'dosage is required').max(100),
  unit: z.string().min(1, 'unit is required').max(50),
  frequency: z.string().min(1, 'frequency is required').max(100),
  route: z.string().max(100).optional(),
  durationDays: z.number().int().positive().optional(),
  instructions: z.string().max(1000).optional(),
  foodInstruction: z.string().max(100).optional(),
});

export const createPrescriptionSchema = z.object({
  patientId: z.string().optional(),
  diagnosis: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  items: z.array(prescriptionItemInputSchema).min(1, 'At least one prescription item is required'),
  healthTopics: z.array(z.string()).optional(),
});

export const updatePrescriptionSchema = z.object({
  diagnosis: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

export const prescriptionStatusSchema = z.object({
  status: z.nativeEnum(PrescriptionStatus),
});

// ==========================================
// PHARMACY NETWORK VALIDATION SCHEMAS
// ==========================================
export const createPharmacySchema = z.object({
  pharmacyId: z.string().min(1, 'pharmacyId is required').max(50),
  name: z.string().min(1, 'name is required').max(200),
  licenseNumber: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tieUpStatus: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).optional(),
});

export const updatePharmacySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  licenseNumber: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tieUpStatus: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).optional(),
});

export const verifyPharmacySchema = z.object({
  isVerified: z.boolean(),
});

export const pharmacyStatusSchema = z.object({
  isActive: z.boolean().optional(),
  tieUpStatus: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).optional(),
});

// ==========================================
// PHARMACY ORDER VALIDATION SCHEMAS
// ==========================================
export const createPharmacyOrderSchema = z.object({
  prescriptionId: z.string().min(1, 'prescriptionId is required'),
  pharmacyId: z.string().min(1, 'pharmacyId is required'),
  deliveryAddress: z.string().max(500).optional(),
  deliveryType: z.string().max(50).optional(),
});

export const declinePharmacyOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updatePharmacyOrderStatusSchema = z.object({
  status: z.string().min(1, 'status is required'),
});

export const processPaymentSchema = z.object({
  paymentMethod: z.string().min(1, 'paymentMethod is required'),
  transactionRef: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const confirmCashPaymentSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const createVitalSchema = z.object({ patientId: z.string().optional(), systolicBp: z.number().int().min(0).max(300).optional(), diastolicBp: z.number().int().min(0).max(200).optional(), heartRate: z.number().int().min(0).max(300).optional(), respiratoryRate: z.number().int().min(0).max(100).optional(), oxygenSaturation: z.number().min(0).max(100).optional(), temperature: z.number().min(20).max(115).optional(), bloodSugar: z.number().min(0).max(1500).optional(), weightKg: z.number().min(0).max(500).optional(), notes: z.string().max(2000).optional(), recordedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional() });
