import { useState, useEffect, useCallback } from 'react';
import { clinicalApi, prescriptionApi, recordApi } from '../services/dhrApis';

export interface MedicationAdherence {
  id: string;
  medicine: string;
  dose: string;
  frequency: string;
  adherencePercent: number | null;
  status: 'Taken as scheduled' | 'Missed doses' | 'Paused' | string;
  isAntibiotic?: boolean;
  startDate?: string;
  endDate?: string;
  instructions?: string;
}

export interface VitalTrend {
  date: string;
  bp: string;
  hr: string;
  temp: string;
  spo2: string;
}

export interface PatientTimelineEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  actor: string;
  type: 'consultation' | 'prescription' | 'lab' | 'nurse' | 'vitals';
  details?: string;
}

export interface LabReportItem {
  id: string;
  testName: string;
  date: string;
  value: string;
  normalRange: string;
  status: 'Normal' | 'Elevated' | 'Critical';
  labName: string;
}

export interface DoctorPatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: string;
  gender: string;
  bloodGroup: string;
  phone?: string;
  appointmentTime?: string;
  chiefComplaint: string;
  allergies: string[];
  diagnosis: string[];
  medications: MedicationAdherence[];
  vitalsHistory: VitalTrend[];
  labReports: LabReportItem[];
  timeline: PatientTimelineEvent[];
  clinicalNotes?: string;
}

export const fetchDoctorPatients = async (): Promise<DoctorPatientRecord[]> => {
  const res = await clinicalApi.getDoctorPatients();
  if (res && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
};

export const useDoctorWorkflow = () => {
  const [records, setRecords] = useState<DoctorPatientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshRecords = useCallback(async () => {
    try {
      const data = await fetchDoctorPatients();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch doctor patients from MySQL:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecords();

    const handleCustomEvent = () => {
      refreshRecords();
    };

    window.addEventListener('medicare_sync_doctor', handleCustomEvent);
    return () => {
      window.removeEventListener('medicare_sync_doctor', handleCustomEvent);
    };
  }, [refreshRecords]);

  const triggerSync = () => {
    window.dispatchEvent(new Event('medicare_sync_doctor'));
  };

  const addTimelineEvent = async (patientId: string, event: Omit<PatientTimelineEvent, 'id'>) => {
    const recordType =
      event.type === 'lab'
        ? 'LAB_REPORT'
        : event.type === 'prescription'
        ? 'PRESCRIPTION'
        : 'CONSULTATION';

    await recordApi.createMedicalRecord({
      patientId,
      title: event.title,
      type: recordType,
      hospital: event.actor || 'Clinical Practice',
      status: 'Reviewed',
      notes: event.details || event.title,
    });

    await refreshRecords();
    triggerSync();
  };

  const addPrescription = async (
    patientId: string,
    med: Omit<MedicationAdherence, 'id' | 'adherencePercent' | 'status'>,
    options?: { diagnosis?: string; notes?: string; healthTopics?: string[] }
  ) => {
    const patient = records.find((p) => p.id === patientId);
    await prescriptionApi.createPrescription({
      patientId,
      diagnosis: options?.diagnosis || patient?.diagnosis?.join(', ') || 'Clinical Consultation',
      notes: options?.notes || med.instructions || 'Prescription issued by attending physician',
      items: [
        {
          medicineName: med.medicine,
          dosage: med.dose,
          unit: 'mg',
          frequency: med.frequency,
          durationDays: 7,
          instructions: med.instructions || 'Take as prescribed',
        },
      ],
      healthTopics: options?.healthTopics,
    });

    await refreshRecords();
    triggerSync();
  };

  const saveClinicalNotes = async (patientId: string, notes: string) => {
    const patient = records.find((p) => p.id === patientId);
    await recordApi.createMedicalRecord({
      patientId,
      title: `Clinical Encounter Note${patient?.name ? ` - ${patient.name}` : ''}`,
      type: 'CONSULTATION',
      status: 'Reviewed',
      notes,
    });

    await refreshRecords();
    triggerSync();
  };

  return {
    records,
    loading,
    refreshRecords,
    addTimelineEvent,
    addPrescription,
    saveClinicalNotes,
  };
};
