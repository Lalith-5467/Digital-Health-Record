import { useState, useEffect } from 'react';
import { clinicalApi, nurseOpsApi, vitalApi } from '../services/dhrApis';

export type BookingStatus =
  | 'Pending'
  | 'Accepted'
  | 'Scheduled'
  | 'On the Way'
  | 'Arrived'
  | 'Care in Progress'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export interface CareRequest {
  id: string;
  patientId?: string;
  patientUserId?: string;
  patientName: string;
  patientAge: string;
  patientGender?: string;
  patientBloodGroup?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAbhaId?: string;
  serviceType: string;
  careCategory?: string;
  prefDate: string;
  scheduledDate?: string | Date;
  time: string;
  duration?: string;
  bookingType?: string;
  repeatFrequency?: string | null;
  endDate?: string | null;
  location: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  locationType?: string;
  distanceKm?: string;
  instructions: string;
  conditionReason?: string;
  mobilityStatus?: string;
  currentMedications?: string;
  allergies?: string;
  medicalEquipment?: string;
  specialCareRequirements?: string;
  nurseGenderPreference?: string;
  preferredExperience?: string;
  preferredLanguage?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyInstructions?: string;
  relationshipToPatient?: string;
  status: BookingStatus;
  createdAt: number;
  nurseId?: string;
  nurseName?: string;
  otpPin?: string;
  declineReason?: string;
  etaMinutes?: number;
  vitals?: {
    bp: string;
    hr: string;
    temp: string;
    spo2: string;
    bs: string;
  };
  notes?: string;
  nurseClinicalNotes?: string;
  metadata?: any;
  checklist?: {
    id: string;
    label: string;
    done: boolean;
  }[];
}

export interface NurseNotification {
  id: string;
  message: string;
  time: number;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const useNurseWorkflow = () => {
  const [bookings, setBookings] = useState<CareRequest[]>([]);

  const refreshBookings = async () => {
    try {
      const res = await clinicalApi.getNurseCareRequests();
      if (res && res.data && Array.isArray(res.data)) {
        setBookings(res.data);
      }
    } catch (err) {
      console.error('Failed to load nurse care requests from MySQL:', err);
    }
  };

  useEffect(() => {
    refreshBookings();

    const handleCustomEvent = () => refreshBookings();
    const handleWindowFocus = () => refreshBookings();

    window.addEventListener('medicare_sync_nurse', handleCustomEvent);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('medicare_sync_nurse', handleCustomEvent);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const triggerSync = () => {
    window.dispatchEvent(new Event('medicare_sync_nurse'));
  };

  const createBooking = async (request: Omit<CareRequest, 'id' | 'status' | 'createdAt'>) => {
    const res = await clinicalApi.createNurseCareRequest({
      serviceType: request.serviceType,
      careCategory: request.careCategory,
      scheduledDate: request.scheduledDate || request.prefDate || new Date().toISOString(),
      scheduledTime: request.time || '10:00 AM',
      duration: request.duration,
      bookingType: request.bookingType,
      repeatFrequency: request.repeatFrequency,
      endDate: request.endDate,
      location: request.location,
      landmark: request.landmark,
      city: request.city,
      pincode: request.pincode,
      locationType: request.locationType,
      conditionReason: request.conditionReason,
      mobilityStatus: request.mobilityStatus,
      currentMedications: request.currentMedications,
      allergies: request.allergies,
      medicalEquipment: request.medicalEquipment,
      specialCareRequirements: request.specialCareRequirements,
      nurseGenderPreference: request.nurseGenderPreference,
      preferredExperience: request.preferredExperience,
      preferredLanguage: request.preferredLanguage,
      emergencyContactName: request.emergencyContactName,
      emergencyContactPhone: request.emergencyContactPhone,
      emergencyInstructions: request.emergencyInstructions,
      instructions: request.instructions,
      patientPhone: request.patientPhone,
      notes: request.notes,
    });
    await refreshBookings();
    triggerSync();
    return res?.data;
  };

  const updateBookingStatus = async (id: string, status: BookingStatus, extra?: Partial<CareRequest>) => {
    if (status === 'Cancelled') {
      await nurseOpsApi.cancelCareRequest(id, extra?.declineReason || extra?.notes);
    } else {
      await clinicalApi.updateCareRequest(id, {
        status,
        ...(extra?.notes ? { notes: extra.notes } : {}),
        ...(extra?.etaMinutes ? { etaMinutes: extra.etaMinutes } : {}),
      });
    }
    await refreshBookings();
    triggerSync();
  };

  const updateBookingData = async (id: string, updates: Partial<CareRequest>) => {
    const target = bookings.find((b) => b.id === id);

    // Persist vitals into MySQL Vital table when nurse logs biometrics
    if (updates.vitals && target?.patientId) {
      const bpParts = String(updates.vitals.bp || '').replace(/[^\d/]/g, '').split('/');
      const systolicBp = bpParts[0] ? parseInt(bpParts[0], 10) : undefined;
      const diastolicBp = bpParts[1] ? parseInt(bpParts[1], 10) : undefined;
      const heartRate = updates.vitals.hr ? parseInt(String(updates.vitals.hr).replace(/[^\d]/g, ''), 10) : undefined;
      const temperature = updates.vitals.temp ? parseFloat(String(updates.vitals.temp).replace(/[^\d.]/g, '')) : undefined;
      const oxygenSaturation = updates.vitals.spo2 ? parseFloat(String(updates.vitals.spo2).replace(/[^\d.]/g, '')) : undefined;
      const bloodSugar = updates.vitals.bs ? parseFloat(String(updates.vitals.bs).replace(/[^\d.]/g, '')) : undefined;

      await vitalApi.createVital({
        patientId: target.patientId,
        systolicBp: Number.isFinite(systolicBp) ? systolicBp : undefined,
        diastolicBp: Number.isFinite(diastolicBp) ? diastolicBp : undefined,
        heartRate: Number.isFinite(heartRate) ? heartRate : undefined,
        temperature: Number.isFinite(temperature) ? temperature : undefined,
        oxygenSaturation: Number.isFinite(oxygenSaturation) ? oxygenSaturation : undefined,
        bloodSugar: Number.isFinite(bloodSugar) ? bloodSugar : undefined,
        notes: updates.notes || 'Logged during nurse home visit',
      });
    }

    if (updates.notes !== undefined || updates.checklist !== undefined) {
      await nurseOpsApi.saveCareRequestNotes(id, {
        ...(updates.notes !== undefined ? { nurseClinicalNotes: updates.notes } : {}),
        ...(updates.checklist !== undefined ? { checklist: updates.checklist } : {}),
      });
    }

    await refreshBookings();
    triggerSync();
  };

  const toggleChecklistItem = async (bookingId: string, itemId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target || !target.checklist) return;
    const updatedList = target.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, checklist: updatedList } : b)));
    try {
      await nurseOpsApi.saveCareRequestNotes(bookingId, { checklist: updatedList });
      triggerSync();
    } catch (err) {
      console.error('Failed to persist checklist item to MySQL:', err);
      await refreshBookings();
    }
  };

  const clearBookings = () => {
    refreshBookings();
  };

  return {
    bookings,
    refreshBookings,
    createBooking,
    updateBookingStatus,
    updateBookingData,
    toggleChecklistItem,
    addNotification: (_title?: string, _message?: string) => { },
    clearBookings,
  };
};
