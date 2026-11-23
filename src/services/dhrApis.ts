import { apiClient } from './apiClient';

export interface PatientProfile {
  id: string;
  userId: string;
  fullName: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName: string;
  speciality: string;
  qualification?: string | null;
  licenseNumber?: string | null;
  hospital?: string | null;
  experienceYears: number;
  consultationFee: number;
  photoUrl?: string | null;
  about?: string | null;
}

export interface UserAccount {
  id: string;
  email: string;
  role: string;
  abhaId?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  profile?: PatientProfile | DoctorProfile | any;
}

export interface MedicalRecordEntity {
  id: string;
  patientId: string;
  doctorId?: string | null;
  title: string;
  type: string;
  hospital?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
  status: string;
  isImportant: boolean;
  notes?: string | null;
  recordDate: string;
  createdAt: string;
}

export interface PrescriptionItemEntity {
  id: string;
  medicineName: string;
  dosage: string;
  unit: string;
  frequency: string;
  durationDays?: number | null;
  instructions?: string | null;
  foodInstruction?: string | null;
}

export interface PrescriptionEntity {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis?: string | null;
  notes?: string | null;
  status: string;
  issuedAt: string;
  validUntil?: string | null;
  items: PrescriptionItemEntity[];
  doctor?: DoctorProfile;
}

export interface AppointmentEntity {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  slotTime: string;
  type: string;
  status: string;
  fee: number | string;
  reason?: string | null;
  notes?: string | null;
  meetingLink?: string | null;
  cancellationReason?: string | null;
  cancellationDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  doctor?: DoctorProfile;
  patient?: PatientProfile;
}

export interface VitalEntity {
  id: string;
  patientId: string;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  temperature?: number | null;
  bloodSugar?: number | null;
  sugarType?: string | null;
  weightKg?: number | null;
  notes?: string | null;
  recordedAt: string;
  date?: string;
  time?: string;
  rawTimestamp?: number;
  status?: string;
}

export interface ReminderEntity {
  id: string;
  patientId: string;
  title: string;
  type: string;
  scheduledTime: string;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  isCompletedToday: boolean;
  notes?: string | null;
  sourcePrescriptionId?: string | null;
  doctorName?: string | null;
  clinicName?: string | null;
  followUpStatus?: string | null;
  followUpDate?: string | null;
  priority?: string | null;
}

export interface NotificationEntity {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  category?: string | null;
  relatedModule?: string | null;
  isRead: boolean;
  createdAt: string;
}

// ==========================================
// DHR API SERVICES
// ==========================================

export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post<{ user: UserAccount; token: string }>('/auth/login', credentials),

  register: (userData: any) =>
    apiClient.post<{ user: UserAccount; token: string }>('/auth/register', userData),

  getCurrentUser: () =>
    apiClient.get<UserAccount>('/auth/me'),

  sendOtp: (email: string, name?: string, role?: string) =>
    apiClient.post<{ success: boolean; message: string; previewCode?: string }>('/auth/send-otp', { email, name, role }),

  verifyOtp: (email: string, otp: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/verify-otp', { email, otp }),

  forgotPassword: (email: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),

  verifyResetCode: (email: string, resetCode: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/verify-reset-code', { email, resetCode }),

  resetPassword: (email: string, resetCode: string, newPassword: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', { email, resetCode, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/change-password', { currentPassword, newPassword }),

  logout: () => apiClient.post('/auth/logout'),
  getSessions: () => apiClient.get<any[]>('/auth/sessions'),
  revokeSession: (id: string) => apiClient.delete(`/auth/sessions/${id}`),
  deactivateAccount: () => apiClient.post('/auth/deactivate'),
};

export const profileApi = {
  getProfile: () => apiClient.get<UserAccount>('/profile'),
  updateProfile: (profileData: any) => apiClient.patch<UserAccount>('/profile', profileData),
  getPatientProfile: () => apiClient.get<any>('/profile/patient'),
  updatePatientProfile: (data: any) => apiClient.put<any>('/profile/patient', data),
  getDoctorProfile: () => apiClient.get<any>('/profile/doctor'),
  updateDoctorProfile: (data: any) => apiClient.put<any>('/profile/doctor', data),
  getNurseProfile: () => apiClient.get<any>('/profile/nurse'),
  updateNurseProfile: (data: any) => apiClient.put<any>('/profile/nurse', data),
  getPharmacistProfile: () => apiClient.get<any>('/profile/pharmacist'),
  updatePharmacistProfile: (data: any) => apiClient.put<any>('/profile/pharmacist', data),
  getCaregiverProfile: () => apiClient.get<any>('/profile/caregiver'),
  updateCaregiverProfile: (data: any) => apiClient.put<any>('/profile/caregiver', data),
  getInsuranceProfile: () => apiClient.get<any>('/profile/insurance'),
  updateInsuranceProfile: (data: any) => apiClient.put<any>('/profile/insurance', data),
  updateAdminProfile: (data: any) => apiClient.put<any>('/profile/admin', data),
  getPreferences: () => apiClient.get<any>('/profile/preferences'),
  updatePreferences: (data: any) => apiClient.put<any>('/profile/preferences', data),
};

export const appointmentApi = {
  getAppointments: () => apiClient.get<AppointmentEntity[]>('/appointments'),
  getAppointmentById: (id: string) => apiClient.get<AppointmentEntity>(`/appointments/${id}`),
  getDoctors: (search?: string, speciality?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (speciality) params.set('speciality', speciality);
    const qs = params.toString();
    return apiClient.get<any[]>(`/appointments/doctors${qs ? `?${qs}` : ''}`);
  },
  getDoctorSlots: (doctorId: string, date: string) =>
    apiClient.get<any>(`/appointments/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`),
  createAppointment: (data: {
    doctorId: string;
    appointmentDate: string;
    slotTime: string;
    type?: string;
    reason?: string;
    notes?: string;
  }) => apiClient.post<AppointmentEntity>('/appointments', data),
  updateAppointment: (id: string, data: any) => apiClient.patch<AppointmentEntity>(`/appointments/${id}`, data),
  cancelAppointment: (id: string, reason?: string) =>
    apiClient.delete<AppointmentEntity>(`/appointments/${id}`, reason ? { reason } : undefined),
};

export const recordApi = {
  getMedicalRecords: (patientId?: string) =>
    apiClient.get<MedicalRecordEntity[]>(patientId ? `/medical-records?patientId=${patientId}` : '/medical-records'),
  getMedicalRecordById: (id: string) => apiClient.get<MedicalRecordEntity>(`/medical-records/${id}`),
  createMedicalRecord: (record: any) => apiClient.post<MedicalRecordEntity>('/medical-records', record),
  updateMedicalRecord: (id: string, data: any) => apiClient.patch<MedicalRecordEntity>(`/medical-records/${id}`, data),
  deleteMedicalRecord: (id: string) => apiClient.delete(`/medical-records/${id}`),
  bulkDeleteMedicalRecords: (ids: string[]) => apiClient.post('/medical-records/bulk-delete', { ids }),
};

export const vitalApi = {
  getVitals: (patientId?: string) =>
    apiClient.get<VitalEntity[]>(patientId ? `/vitals?patientId=${patientId}` : '/vitals'),
  createVital: (vital: Partial<VitalEntity>) => apiClient.post<VitalEntity>('/vitals', vital),
};

export const reminderApi = {
  getReminders: (patientId?: string) =>
    apiClient.get<ReminderEntity[]>(patientId ? `/reminders?patientId=${patientId}` : '/reminders'),
  createReminder: (reminder: Partial<ReminderEntity>) => apiClient.post<ReminderEntity>('/reminders', reminder),
  updateReminder: (id: string, data: Partial<ReminderEntity>) => apiClient.patch<ReminderEntity>(`/reminders/${id}`, data),
  updateFollowUpStatus: (id: string, followUpStatus: 'Accepted' | 'Declined') =>
    apiClient.patch<ReminderEntity>(`/reminders/${id}/follow-up`, { followUpStatus }),
  deleteReminder: (id: string) => apiClient.delete(`/reminders/${id}`),
};

export const medicineApi = {
  getMedicines: (search?: string, category?: string) =>
    apiClient.get<any[]>(`/medicines?${search ? `search=${encodeURIComponent(search)}&` : ''}${category ? `category=${encodeURIComponent(category)}` : ''}`),
  getActiveMedications: (patientId?: string) =>
    apiClient.get<{ medications: any[]; todayDoses: any[] }>(patientId ? `/medicines/active?patientId=${patientId}` : '/medicines/active'),
  getAdherenceTrends: (patientId?: string) =>
    apiClient.get<{ summary: any; timeSeries: any[]; hasData: boolean }>(patientId ? `/medicines/adherence?patientId=${patientId}` : '/medicines/adherence'),
  getDoseHistory: (range = '30d', patientId?: string) =>
    apiClient.get<any[]>(`/medicines/dose-history?range=${range}${patientId ? `&patientId=${patientId}` : ''}`),
  createPatientMedication: (data: any) => apiClient.post('/medicines/patient-meds', data),
  updatePatientMedication: (id: string, data: any) => apiClient.patch(`/medicines/patient-meds/${id}`, data),
  deletePatientMedication: (id: string) => apiClient.delete(`/medicines/patient-meds/${id}`),
  recordDoseLog: (data: { doseId: string; medicineId: string; status: 'taken' | 'skipped' | 'upcoming'; skipReason?: string }) =>
    apiClient.post('/medicines/dose-log', data),
  createMedicine: (med: any) => apiClient.post('/medicines', med),
};

export const patientClinicalApi = {
  getAllergies: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/allergies${patientId ? `?patientId=${patientId}` : ''}`),
  createAllergy: (data: any) => apiClient.post<any>('/patient-clinical/allergies', data),
  deleteAllergy: (id: string) => apiClient.delete(`/patient-clinical/allergies/${id}`),

  getConditions: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/conditions${patientId ? `?patientId=${patientId}` : ''}`),
  createCondition: (data: any) => apiClient.post<any>('/patient-clinical/conditions', data),
  deleteCondition: (id: string) => apiClient.delete(`/patient-clinical/conditions/${id}`),

  getSurgeries: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/surgeries${patientId ? `?patientId=${patientId}` : ''}`),
  createSurgery: (data: any) => apiClient.post<any>('/patient-clinical/surgeries', data),
  deleteSurgery: (id: string) => apiClient.delete(`/patient-clinical/surgeries/${id}`),

  getWellnessLogs: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/wellness${patientId ? `?patientId=${patientId}` : ''}`),
  createWellnessLog: (data: any) => apiClient.post<any>('/patient-clinical/wellness', data),

  getEmergencyContacts: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/emergency/contacts${patientId ? `?patientId=${patientId}` : ''}`),
  createEmergencyContact: (data: any) => apiClient.post<any>('/patient-clinical/emergency/contacts', data),
  updateEmergencyContact: (id: string, data: any) => apiClient.put<any>(`/patient-clinical/emergency/contacts/${id}`, data),
  deleteEmergencyContact: (id: string) => apiClient.delete(`/patient-clinical/emergency/contacts/${id}`),

  getSosAlerts: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/emergency/sos${patientId ? `?patientId=${patientId}` : ''}`),
  triggerSosAlert: (data: any) => apiClient.post<any>('/patient-clinical/emergency/sos', data),
  resolveSosAlert: (id: string, data?: any) => apiClient.patch<any>(`/patient-clinical/emergency/sos/${id}/resolve`, data || {}),

  getGoals: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/analytics/goals${patientId ? `?patientId=${patientId}` : ''}`),
  createGoal: (data: any) => apiClient.post<any>('/patient-clinical/analytics/goals', data),
  updateGoal: (id: string, data: any) => apiClient.patch<any>(`/patient-clinical/analytics/goals/${id}`, data),
  deleteGoal: (id: string) => apiClient.delete(`/patient-clinical/analytics/goals/${id}`),
  getAnalyticsSummary: (range = '30d', patientId?: string) =>
    apiClient.get<any>(`/patient-clinical/analytics/summary?range=${range}${patientId ? `&patientId=${patientId}` : ''}`),

  getCheckups: (patientId?: string) => apiClient.get<any[]>(`/patient-clinical/checkups${patientId ? `?patientId=${patientId}` : ''}`),
  saveCheckup: (data: any) => apiClient.post<any>('/patient-clinical/checkups', data),
  deleteCheckup: (id: string) => apiClient.delete(`/patient-clinical/checkups/${id}`),
};

export const insuranceApi = {
  getPolicies: (search?: string) => apiClient.get<any[]>(`/insurance/policies${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPolicyById: (id: string) => apiClient.get<any>(`/insurance/policies/${id}`),
  createPolicy: (data: any) => apiClient.post('/insurance/policies', data),
  updatePolicy: (id: string, data: any) => apiClient.patch(`/insurance/policies/${id}`, data),
  deletePolicy: (id: string) => apiClient.delete(`/insurance/policies/${id}`),

  getClaims: (status?: string) => apiClient.get<any[]>(`/insurance/claims${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createClaim: (data: any) => apiClient.post('/insurance/claims', data),
  updateClaimStatus: (id: string, data: { status: string; approvedAmount?: number; reason?: string }) =>
    apiClient.patch(`/insurance/claims/${id}/status`, data),

  getPreAuthorizations: () => apiClient.get<any[]>('/insurance/preauth'),
  createPreAuthorization: (data: any) => apiClient.post<any>('/insurance/preauth', data),
  updatePreAuthorizationStatus: (id: string, data: any) => apiClient.patch<any>(`/insurance/preauth/${id}/status`, data),

  getSettlements: () => apiClient.get<any[]>('/insurance/settlements'),
  createSettlement: (data: any) => apiClient.post<any>('/insurance/settlements', data),
  updateSettlementStatus: (id: string, data: any) => apiClient.patch<any>(`/insurance/settlements/${id}/status`, data),

  getDocuments: (policyId?: string) => apiClient.get<any[]>(`/insurance/documents${policyId ? `?policyId=${policyId}` : ''}`),
  addDocument: (data: any) => apiClient.post<any>('/insurance/documents', data),
  updateDocumentStatus: (id: string, status: string) => apiClient.patch<any>(`/insurance/documents/${id}/status`, { status }),
  deleteDocument: (id: string) => apiClient.delete(`/insurance/documents/${id}`),

  getFamilyMembers: (policyId?: string) => apiClient.get<any[]>(`/insurance/family-members${policyId ? `?policyId=${policyId}` : ''}`),
  addFamilyMember: (data: any) => apiClient.post<any>('/insurance/family-members', data),
  deleteFamilyMember: (id: string) => apiClient.delete(`/insurance/family-members/${id}`),

  getPremiumPayments: (policyId?: string) => apiClient.get<any[]>(`/insurance/premium-payments${policyId ? `?policyId=${policyId}` : ''}`),
  recordPremiumPayment: (data: any) => apiClient.post<any>('/insurance/premium-payments', data),

  getAgentPayouts: () => apiClient.get<any[]>('/insurance/agent-payouts'),
  createAgentPayout: (data: any) => apiClient.post<any>('/insurance/agent-payouts', data),

  getTpaSettings: () => apiClient.get<any>('/insurance/tpa-settings'),
  updateTpaSettings: (data: any) => apiClient.put<any>('/insurance/tpa-settings', data),

  getNetworkHospitals: (search?: string) =>
    apiClient.get<any[]>(`/insurance/network-hospitals${search ? `?search=${encodeURIComponent(search)}` : ''}`),
};

export const nurseOpsApi = {
  getInventory: () => apiClient.get<any[]>('/nurse-ops/inventory'),
  createInventoryItem: (data: any) => apiClient.post<any>('/nurse-ops/inventory', data),
  updateInventoryItem: (id: string, data: any) => apiClient.patch<any>(`/nurse-ops/inventory/${id}`, data),
  deleteInventoryItem: (id: string) => apiClient.delete(`/nurse-ops/inventory/${id}`),

  getRestockRequests: () => apiClient.get<any[]>('/nurse-ops/restock-requests'),
  createRestockRequest: (data: any) => apiClient.post<any>('/nurse-ops/restock-requests', data),
  updateRestockRequest: (id: string, data: any) => apiClient.patch<any>(`/nurse-ops/restock-requests/${id}`, data),

  getClinicalAlerts: (status?: string) => apiClient.get<any[]>(`/nurse-ops/alerts${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createClinicalAlert: (data: any) => apiClient.post<any>('/nurse-ops/alerts', data),
  updateClinicalAlertStatus: (id: string, status: string) => apiClient.patch<any>(`/nurse-ops/alerts/${id}/status`, { status }),

  saveCareRequestNotes: (id: string, data: { nurseClinicalNotes?: string; checklist?: any[]; status?: string; etaMinutes?: number }) =>
    apiClient.patch<any>(`/nurse-ops/care-requests/${id}/notes`, data),
  cancelCareRequest: (id: string, reason?: string) =>
    apiClient.patch<any>(`/nurse-ops/care-requests/${id}/cancel`, { reason }),
};

export const caregiverApi = {
  getWards: () => apiClient.get<any[]>('/caregiver/wards'),
  getWardRecords: (patientId: string) => apiClient.get<any>(`/caregiver/ward-records/${patientId}`),
  addDependent: (data: any) => apiClient.post<any[]>('/caregiver/dependents', data),
  removeDependent: (patientId: string) => apiClient.delete<any>(`/caregiver/dependents/${patientId}`),
  getTasks: (patientId?: string) => apiClient.get<any[]>(patientId ? `/caregiver/tasks?patientId=${patientId}` : '/caregiver/tasks'),
  createTask: (data: any) => apiClient.post('/caregiver/tasks', data),
  updateTask: (id: string, data: { status?: string; notes?: string; title?: string; scheduledTime?: string }) => apiClient.patch(`/caregiver/tasks/${id}`, data),
  deleteTask: (id: string) => apiClient.delete(`/caregiver/tasks/${id}`),
  logVital: (data: any) => apiClient.post('/caregiver/vitals', data),
  getWardNotes: (patientId: string) => apiClient.get<any[]>(`/caregiver/ward-notes?patientId=${patientId}`),
  createWardNote: (data: { patientId: string; category?: string; content: string }) => apiClient.post<any>('/caregiver/ward-notes', data),
  updatePatientLocation: (data: { patientId: string; lastKnownLocation?: string; geofenceRadiusMeters?: number }) =>
    apiClient.patch<any>('/caregiver/location', data),
  getCareCircle: (patientId: string) => apiClient.get<any>(`/caregiver/care-circle?patientId=${patientId}`),
  addCareCircleMember: (data: any) => apiClient.post<any>('/caregiver/care-circle/members', data),
  removeCareCircleMember: (patientId: string, targetCaregiverId: string) => apiClient.delete<any>(`/caregiver/care-circle/members/${targetCaregiverId}?patientId=${patientId}`),
  toggleConsentStatus: (patientId: string, status: 'Active' | 'Revoked', scopes?: Record<string, boolean>, caregiverId?: string) =>
    apiClient.patch<any>('/caregiver/consent/status', { patientId, status, scopes, caregiverId }),
};

export const prescriptionApi = {
  getPrescriptions: (patientId?: string) =>
    apiClient.get<PrescriptionEntity[]>(patientId ? `/prescriptions?patientId=${patientId}` : '/prescriptions'),
  getPrescriptionById: (id: string) => apiClient.get<PrescriptionEntity>(`/prescriptions/${id}`),
  createPrescription: (prescriptionData: any) => apiClient.post<PrescriptionEntity>('/prescriptions', prescriptionData),
  confirmPrescription: (id: string) => apiClient.patch<PrescriptionEntity>(`/prescriptions/${id}/confirm`, {}),
  getHealthTopics: () => apiClient.get<{ success: boolean; data: any[] }>('/health-topics'),
};

export const pharmacyApi = {
  getPharmacies: () => apiClient.get<any[]>('/pharmacies'),
  getAvailablePharmacies: () => apiClient.get<any[]>('/pharmacies/available'),
  getPharmacyOrders: (patientId?: string) =>
    apiClient.get<any[]>(patientId ? `/pharmacy-orders?patientId=${patientId}` : '/pharmacy-orders'),
  getPharmacyOrderById: (id: string) => apiClient.get<any>(`/pharmacy-orders/${id}`),
  createPharmacyOrder: (orderData: any) => apiClient.post<any>('/pharmacy-orders', orderData),
  updateOrderStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch<any>(`/pharmacy-orders/${id}/status`, { status, notes }),
  declineOrder: (id: string, reason: string) =>
    apiClient.patch<any>(`/pharmacy-orders/${id}/decline`, { reason }),
  cancelOrder: (id: string, reason?: string) =>
    apiClient.patch<any>(`/pharmacy-orders/${id}/cancel`, { reason }),
};

export const pharmacyOpsApi = {
  getInventory: (pharmacyId?: string) =>
    apiClient.get<any[]>(pharmacyId ? `/pharmacy-ops/inventory?pharmacyId=${encodeURIComponent(pharmacyId)}` : '/pharmacy-ops/inventory'),
  upsertInventoryItem: (data: any) => apiClient.post<any>('/pharmacy-ops/inventory', data),
  updateInventoryItem: (id: string, data: any) => apiClient.patch<any>(`/pharmacy-ops/inventory/${id}`, data),
  deleteInventoryItem: (id: string) => apiClient.delete(`/pharmacy-ops/inventory/${id}`),

  getInvoices: () => apiClient.get<any[]>('/pharmacy-ops/invoices'),
  generateInvoice: (orderId: string) => apiClient.post<any>(`/pharmacy-ops/invoices/${orderId}`, {}),

  getSupplierOrders: () => apiClient.get<any[]>('/pharmacy-ops/supplier-orders'),
  createSupplierOrder: (data: any) => apiClient.post<any>('/pharmacy-ops/supplier-orders', data),
  updateSupplierOrderStatus: (id: string, status: string) =>
    apiClient.patch<any>(`/pharmacy-ops/supplier-orders/${id}/status`, { status }),

  getScheduleAudit: () => apiClient.get<any[]>('/pharmacy-ops/schedule-audit'),
  createScheduleAuditLog: (data: any) => apiClient.post<any>('/pharmacy-ops/schedule-audit', data),

  getDrugInteractions: () => apiClient.get<any[]>('/pharmacy-ops/drug-interactions'),
  checkDrugInteractions: (drugs: string[]) =>
    apiClient.post<any[]>('/pharmacy-ops/drug-interactions/check', { drugs }),
  createDrugInteraction: (data: any) => apiClient.post<any>('/pharmacy-ops/drug-interactions', data),

  getOrderMessages: (orderId: string) => apiClient.get<any[]>(`/pharmacy-ops/orders/${orderId}/messages`),
  postOrderMessage: (orderId: string, text: string) =>
    apiClient.post<any>(`/pharmacy-ops/orders/${orderId}/messages`, { text }),
  cancelPharmacyOrder: (orderId: string, reason?: string) =>
    apiClient.patch<any>(`/pharmacy-orders/${orderId}/cancel`, { reason }),
};

export const notificationApi = {
  getNotifications: () => apiClient.get<NotificationEntity[]>('/notifications'),
  markAsRead: (id: string) => apiClient.patch<NotificationEntity>(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/read-all'),
  deleteNotification: (id: string) => apiClient.delete(`/notifications/${id}`),
  clearAllNotifications: () => apiClient.delete('/notifications/clear-all'),
};

export const dashboardApi = {
  getStats: () => apiClient.get<any>('/dashboard/stats'),
};

export const clinicalApi = {
  getDoctorPatients: () => apiClient.get<any[]>('/clinical/doctor-patients'),
  getNurseCareRequests: () => apiClient.get<any[]>('/clinical/nurse-care-requests'),
  getMyCareRequests: () => apiClient.get<any[]>('/clinical/my-care-requests'),
  createNurseCareRequest: (data: any) => apiClient.post<any>('/clinical/nurse-care-requests', data),
  updateCareRequest: (id: string, data: any) => apiClient.patch<any>(`/clinical/nurse-care-requests/${id}`, data),
};

export const adminApi = {
  getUsers: (params?: { page?: number; limit?: number; role?: string; status?: string; search?: string; hospital?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiClient.get<any[]>(`/admin/users?${query}`);
  },
  getUserById: (id: string) => apiClient.get<any>(`/admin/users/${id}`),
  createUser: (userData: any) => apiClient.post<any>('/admin/users', userData),
  updateUser: (id: string, userData: any) => apiClient.put<any>(`/admin/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete<any>(`/admin/users/${id}`),
  updateUserStatus: (id: string, status: string) => apiClient.patch<any>(`/admin/users/${id}/status`, { status }),
  updateUserRole: (id: string, role: string) => apiClient.patch<any>(`/admin/users/${id}/role`, { role }),
  resetPassword: (id: string, password?: string) => apiClient.post<any>(`/admin/users/${id}/reset-password`, { password }),
  getAuditLogs: (params?: { page?: number; limit?: number; module?: string; action?: string; search?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiClient.get<any>(`/admin/audit-logs?${query}`);
  },
  // Hospitals Management APIs
  getHospitals: () => apiClient.get<any[]>('/admin/hospitals'),
  createHospital: (hospitalData: any) => apiClient.post<any>('/admin/hospitals', hospitalData),
  updateHospital: (id: string, hospitalData: any) => apiClient.put<any>(`/admin/hospitals/${id}`, hospitalData),
  deleteHospital: (id: string) => apiClient.delete<any>(`/admin/hospitals/${id}`),
};

export const hospitalAuthApi = {
  login: (credentials: { email: string; password?: string }) =>
    apiClient.post<{ token: string; user: any; hospital: any }>('/auth/hospital/login', credentials),
  register: (facilityData: any) =>
    apiClient.post<any>('/auth/hospital/register', facilityData),
  getStatus: (identifier: string) =>
    apiClient.get<any>(`/auth/hospital/status/${encodeURIComponent(identifier)}`),
};

export interface BrandingConfig {
  appName: string;
  tagline: string;
  brandText?: string;
  primaryColor: string;
  accentColor: string;
  themeMode: 'auto' | 'light' | 'dark';
  logoUrl?: string | null;
  alternateLogoUrl?: string | null;
  faviconUrl?: string | null;
  loginTitle: string;
  loginSubtitle: string;
}

export interface LandingHeroConfig {
  badge?: string;
  title: string;
  highlightTitle: string;
  subtitle: string;
  primaryCtaText: string;
  primaryCtaAction: string;
  secondaryCtaText: string;
  secondaryCtaAction: string;
  backgroundVideoUrl?: string;
  backgroundImageUrl?: string;
  mediaType?: 'video' | 'image';
  overlayStyle?: 'light' | 'medium' | 'dark' | 'gradient';
  showSosCard?: boolean;
  sosCardTitle?: string;
  sosCardSubtitle?: string;
  showSoundControl?: boolean;
  showIndicators?: boolean;
  enabled?: boolean;
}

export interface LandingAboutConfig {
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  learnMoreText: string;
  imageUrl?: string;
  secondaryImageUrl?: string;
  missionImageUrl?: string;
  visionImageUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  videoTitle?: string;
  videoDescription?: string;
  showVideo?: boolean;
  galleryImages?: string[];
}

export interface LandingFeaturesConfig {
  badge: string;
  title: string;
  highlightTitle?: string;
  subtitle: string;
}

export interface LandingCtaConfig {
  title: string;
  subtitle: string;
  primaryButtonText: string;
  secondaryButtonText: string;
}

export interface LandingConfig {
  sectionsVisibility: {
    hero: boolean;
    about: boolean;
    features: boolean;
    doctors: boolean;
    abha: boolean;
    partnerLoop: boolean;
    cta: boolean;
  };
  sectionsOrder: string[];
  hero: LandingHeroConfig;
  about: LandingAboutConfig;
  features: LandingFeaturesConfig;
  cta: LandingCtaConfig;
}

export interface HeaderNavItem {
  id: string;
  label: string;
  url?: string;
  visible: boolean;
  order: number;
  isMega?: boolean;
  removable?: boolean;
}

export interface HeaderConfig {
  navItems: HeaderNavItem[];
  showProgressBar: boolean;
  showSearch: boolean;
}

export interface FooterConfig {
  footerText: string;
  aboutText: string;
  complianceNotice: string;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    [key: string]: string | undefined;
  };
  sectionVisibility: {
    brand: boolean;
    product: boolean;
    care: boolean;
    account: boolean;
  };
}

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  enabled: boolean;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WidgetConfigItem {
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
  colSpan?: 'full' | 'half' | 'third';
  order: number;
  removable?: boolean;
}

export interface RoleDashboardConfig {
  announcement: {
    id?: string;
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'alert';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    startDate?: string | null;
    endDate?: string | null;
  };
  announcements?: AnnouncementItem[];
  widgets: Record<string, boolean>;
  widgetList?: WidgetConfigItem[];
}

export interface DashboardsConfig {
  patient: RoleDashboardConfig;
  doctor: RoleDashboardConfig;
  nurse: RoleDashboardConfig;
  caregiver: RoleDashboardConfig;
  pharmacist: RoleDashboardConfig;
  insurance: RoleDashboardConfig;
  admin: RoleDashboardConfig;
  superAdmin: RoleDashboardConfig;
}

export interface SystemSettingsEntity {
  id: string;
  hospitalName: string;
  tagline?: string;
  logoUrl?: string | null;
  supportEmail: string;
  supportPhone?: string | null;
  emergencyPhone?: string | null;
  sessionTimeout: number;
  mfaEnforced: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  maintenanceMode: boolean;
  footerText?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
  branding?: BrandingConfig;
  landing?: LandingConfig;
  header?: HeaderConfig;
  footer?: FooterConfig;
  dashboards?: DashboardsConfig;
  draft?: any;
  rbacMatrix?: Record<string, Record<string, boolean>>;
}

export const settingsApi = {
  getSettings: () => apiClient.get<SystemSettingsEntity>('/settings'),
  getAdminSettings: () => apiClient.get<SystemSettingsEntity>('/admin/settings'),
  updateSettings: (data: any) => apiClient.put<SystemSettingsEntity>('/admin/settings', data),
  publishDraft: () => apiClient.post<any>('/admin/settings/publish', {}),
  resetSettings: () => apiClient.post<any>('/admin/settings/reset', {}),
  getRbacMatrix: () => apiClient.get<Record<string, Record<string, boolean>>>('/admin/roles-permissions/matrix'),
  updateRbacMatrix: (matrix: Record<string, Record<string, boolean>>) => apiClient.put<any>('/admin/roles-permissions/matrix', { matrix }),

  // Role Dashboards CRUD operations
  createAnnouncement: (role: string, data: Partial<AnnouncementItem>) =>
    apiClient.post<any>(`/admin/settings/dashboards/${role}/announcements`, data),
  updateAnnouncement: (role: string, id: string, data: Partial<AnnouncementItem>) =>
    apiClient.put<any>(`/admin/settings/dashboards/${role}/announcements/${id}`, data),
  deleteAnnouncement: (role: string, id: string) =>
    apiClient.delete<any>(`/admin/settings/dashboards/${role}/announcements/${id}`),
  toggleAnnouncement: (role: string, id: string) =>
    apiClient.patch<any>(`/admin/settings/dashboards/${role}/announcements/${id}/toggle`),
  updateRoleWidgets: (role: string, data: { widgets?: Record<string, boolean>; widgetList?: WidgetConfigItem[] }) =>
    apiClient.put<any>(`/admin/settings/dashboards/${role}/widgets`, data),
  resetRoleWidgets: (role: string) =>
    apiClient.post<any>(`/admin/settings/dashboards/${role}/widgets/reset`),
};

export const uploadApi = {
  uploadImage: (file: File, category: string = 'GENERAL') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return apiClient.post<{
      id: string;
      url: string;
      fileName: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      category: string;
    }>('/upload', formData);
  },
};

export const patientExtendedApi = {
  // Family Connect
  getFamilyConnections: () => apiClient.get<any[]>('/patient-extended/family'),
  createFamilyConnection: (data: any) => apiClient.post<any>('/patient-extended/family', data),
  updateFamilyConnection: (id: string, data: any) => apiClient.patch<any>(`/patient-extended/family/${id}`, data),
  deleteFamilyConnection: (id: string) => apiClient.delete(`/patient-extended/family/${id}`),
  getFamilyMessages: (connectionId: string) => apiClient.get<any[]>(`/patient-extended/family/${connectionId}/messages`),
  postFamilyMessage: (connectionId: string, text: string) =>
    apiClient.post<any>(`/patient-extended/family/${connectionId}/messages`, { text }),
  shareFamilyItem: (data: any) => apiClient.post<any>('/patient-extended/family/shared', data),

  // Hospitals Directory & Saved/Reviews
  getHospitals: (search?: string) =>
    apiClient.get<any[]>(`/patient-extended/hospitals${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  toggleSaveHospital: (hospitalId: string, isSaved?: boolean) =>
    apiClient.post<any>(`/patient-extended/hospitals/${hospitalId}/save`, isSaved !== undefined ? { isSaved } : {}),
  createHospitalReview: (hospitalId: string, rating: number, comment?: string) =>
    apiClient.post<any>(`/patient-extended/hospitals/${hospitalId}/reviews`, { rating, comment }),

  // Lab Tests
  getLabTests: () => apiClient.get<any[]>('/patient-extended/lab-tests'),
  createLabTest: (data: any) => apiClient.post<any>('/patient-extended/lab-tests', data),
  updateLabTest: (id: string, data: any) => apiClient.patch<any>(`/patient-extended/lab-tests/${id}`, data),
  deleteLabTest: (id: string) => apiClient.delete(`/patient-extended/lab-tests/${id}`),

  // Sanitation Bookings
  getSanitationBookings: () => apiClient.get<any[]>('/patient-extended/sanitation'),
  createSanitationBooking: (data: any) => apiClient.post<any>('/patient-extended/sanitation', data),
  updateSanitationBooking: (id: string, data: any) => apiClient.patch<any>(`/patient-extended/sanitation/${id}`, data),

  // Report Insights
  getReportInsights: () => apiClient.get<any[]>('/patient-extended/report-insights'),
  createReportInsight: (data: any) => apiClient.post<any>('/patient-extended/report-insights', data),
  updateReportInsight: (id: string, data: any) => apiClient.patch<any>(`/patient-extended/report-insights/${id}`, data),

  // Diet Assessment
  getDietAssessment: () => apiClient.get<any>('/patient-extended/diet-assessment'),
  saveDietAssessment: (data: any) => apiClient.put<any>('/patient-extended/diet-assessment', data),

  // AI Assistant & Saved Notes
  getAiConversations: () => apiClient.get<any[]>('/patient-extended/ai/conversations'),
  createAiConversation: (data?: { title?: string; topic?: string }) =>
    apiClient.post<any>('/patient-extended/ai/conversations', data || {}),
  postAiMessage: (conversationId: string, sender: 'user' | 'assistant', text: string, metadata?: any) =>
    apiClient.post<any>(`/patient-extended/ai/conversations/${conversationId}/messages`, { sender, text, metadata }),
  deleteAiConversation: (id: string) => apiClient.delete(`/patient-extended/ai/conversations/${id}`),
  getSavedHealthNotes: () => apiClient.get<any[]>('/patient-extended/ai/notes'),
  createSavedHealthNote: (data: { title: string; content: string; category?: string }) =>
    apiClient.post<any>('/patient-extended/ai/notes', data),
  deleteSavedHealthNote: (id: string) => apiClient.delete(`/patient-extended/ai/notes/${id}`),
};

export const healthShortsEngagementApi = {
  getInteraction: (videoId: string) => apiClient.get<any>(`/health-shorts/${videoId}/interact`),
  upsertInteraction: (videoId: string, data: { isLiked?: boolean; isSaved?: boolean; watchSeconds?: number }) =>
    apiClient.post<any>(`/health-shorts/${videoId}/interact`, data),
  getComments: (videoId: string) => apiClient.get<any[]>(`/health-shorts/${videoId}/comments`),
  postComment: (videoId: string, content: string) =>
    apiClient.post<any>(`/health-shorts/${videoId}/comments`, { content }),
};

export const adminExtendedApi = {
  dispatchNotification: (data: { userId?: string; targetRole?: string; title: string; message: string; type?: string; category?: string }) =>
    apiClient.post<any>('/admin/notifications/dispatch', data),
  getClinicalOverview: () => apiClient.get<any>('/admin/clinical-overview'),
};
