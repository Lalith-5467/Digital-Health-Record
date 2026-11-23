import { useState, useEffect, useCallback } from 'react';
import { caregiverApi, patientClinicalApi, notificationApi, medicineApi, appointmentApi, pharmacyApi } from '../services/dhrApis';

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  timing: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'As Needed';
  instructions: string;
  takenToday: boolean;
  takenAt?: string;
  stockLeft: number;
  totalStock: number;
  pillColor: string;
  shape: 'round' | 'capsule' | 'oval' | 'syrup' | 'inhaler';
  prescribedBy: string;
}

export interface VitalRecord {
  id: string;
  date: string;
  time: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  bloodSugar?: number;
  sugarType?: 'Fasting' | 'Post-Meal' | 'Random';
  spo2?: number;
  temperature?: number;
  weight?: number;
  notes?: string;
  status: 'normal' | 'elevated' | 'critical';
}

export type CareTaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

export interface CareTask {
  id: string;
  wardId: string;
  title: string;
  category: 'Medication' | 'Vitals' | 'Nutrition' | 'Mobility' | 'Hygiene' | 'Doctor' | 'Hydration' | 'Personal Care' | 'Wellness';
  dueDate?: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  status?: CareTaskStatus;
  completedAt?: string;
  assignedTo: string;
  notes?: string;
  instructions?: string;
}

export interface WardAppointment {
  id: string;
  wardId: string;
  doctorName: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  mode: 'In-Clinic' | 'Video Consultation' | 'Home Visit';
  status: 'Upcoming' | 'Completed' | 'Rescheduled' | 'Cancelled';
  notes?: string;
  meetLink?: string;
}

export interface EmergencyAlert {
  id: string;
  wardId: string;
  wardName: string;
  timestamp: number;
  type: 'Fall Detected' | 'SOS Panic Button' | 'Abnormal Vitals' | 'Geofence Breach' | 'Manual Alert';
  location: string;
  status: 'Active' | 'Dispatched' | 'Resolved';
  responder?: string;
}

export interface WardDependent {
  id: string;
  name: string;
  relationship: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  abhaId: string;
  bloodGroup: string;
  primaryCondition: string;
  allergies: string[];
  photoUrl?: string;
  emergencyContact: string;
  primaryDoctor: {
    name: string;
    specialty: string;
    phone: string;
    hospital: string;
  };
  geofenceStatus: 'Inside Safe Zone' | 'Near Boundary' | 'Outside Safe Zone';
  currentLocation: string;
  lastLocationUpdate: string;
  overallStatus: 'Stable' | 'Needs Attention' | 'Alert' | 'Recovering';
  accessLevel: 'Full Legal Guardian' | 'Medical Proxy' | 'Emergency Viewer';
  vitals: VitalRecord[];
  medications: MedicationItem[];
  appointments: WardAppointment[];
  careRequests?: any[];
  notes: Array<{ id: string; date: string; time: string; author: string; text: string; tag: string }>;
}

export type CaregiverNotificationType =
  | 'Appointment Reminder'
  | 'Appointment Status'
  | 'Nurse Booking'
  | 'Care Task'
  | 'Vital Alert'
  | 'ABHA Update'
  | 'General Caregiver Alert';

export interface CaregiverNotification {
  id: string;
  dependentId: string;
  wardName?: string;
  title: string;
  message: string;
  type: CaregiverNotificationType;
  timestamp: string;
  read: boolean;
  priority: 'normal' | 'high';
  route?: string;
  relatedRoute?: string;
  actionRoute?: string;
}

const EMPTY_WARD: WardDependent = {
  id: '',
  name: 'No Dependent Linked',
  relationship: 'Dependent',
  age: 0,
  gender: 'Other',
  abhaId: '—',
  bloodGroup: '—',
  primaryCondition: 'None recorded',
  allergies: [],
  emergencyContact: '—',
  primaryDoctor: { name: '—', specialty: 'General Medicine', phone: '—', hospital: '—' },
  geofenceStatus: 'Inside Safe Zone',
  currentLocation: 'Not recorded',
  lastLocationUpdate: '—',
  overallStatus: 'Stable',
  accessLevel: 'Full Legal Guardian',
  vitals: [],
  medications: [],
  appointments: [],
  careRequests: [],
  notes: [],
};

function mapBackendWard(p: any): WardDependent {
  const age = p.dateOfBirth
    ? Math.max(0, Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : 0;
  const link = Array.isArray(p.caregiverLinks) ? p.caregiverLinks[0] : null;
  const vitals: VitalRecord[] = (p.vitals || []).map((v: any) => {
    const sys = v.systolicBp ?? undefined;
    const dia = v.diastolicBp ?? undefined;
    const spo2 = v.oxygenSaturation ?? undefined;
    let status: VitalRecord['status'] = 'normal';
    if ((sys && sys >= 160) || (spo2 && spo2 < 92)) status = 'critical';
    else if ((sys && sys >= 140) || (dia && dia >= 90) || (v.bloodSugar && v.bloodSugar >= 180)) status = 'elevated';
    const d = v.recordedAt ? new Date(v.recordedAt) : new Date();
    return {
      id: v.id,
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      systolic: sys,
      diastolic: dia,
      heartRate: v.heartRate ?? undefined,
      bloodSugar: v.bloodSugar ?? undefined,
      spo2,
      temperature: v.temperature ?? undefined,
      weight: v.weightKg ?? undefined,
      notes: v.notes || '',
      status,
    };
  });

  const medications: MedicationItem[] = (p.patientMedications || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    dosage: m.dosage || '1 Tablet',
    timing: 'Morning',
    instructions: m.notes || m.frequency || 'As prescribed',
    takenToday: false,
    stockLeft: Number(m.totalQuantity ?? 30),
    totalStock: Math.max(30, Number(m.totalQuantity ?? 30)),
    pillColor: 'bg-teal-500',
    shape: 'round',
    prescribedBy: m.prescribedBy || 'Attending Physician',
  }));

  const appointments: WardAppointment[] = (p.appointments || []).map((a: any) => ({
    id: a.id,
    wardId: p.id,
    doctorName: a.doctor?.fullName || 'Attending Physician',
    specialty: a.doctor?.speciality || 'General Medicine',
    hospital: a.doctor?.hospital || a.location || 'Clinic',
    date: a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    time: a.slotTime || '10:00 AM',
    mode: a.type === 'VIDEO' ? 'Video Consultation' : 'In-Clinic',
    status: a.status === 'COMPLETED' ? 'Completed' : a.status === 'CANCELLED' ? 'Cancelled' : 'Upcoming',
    notes: a.reason || a.notes || '',
  }));

  return {
    id: p.id,
    name: p.fullName || 'Dependent',
    relationship: link?.relationship || 'Dependent',
    age,
    gender: (p.gender === 'Male' || p.gender === 'Female' ? p.gender : 'Other') as any,
    abhaId: p.user?.abhaId || '—',
    bloodGroup: p.bloodGroup || '—',
    primaryCondition: p.conditions?.[0]?.name || p.criticalMedicalNotes || 'Routine Care',
    allergies: (p.allergies || []).map((a: any) => a.allergen),
    emergencyContact: p.emergencyContactPhone || p.user?.phoneNumber || '—',
    primaryDoctor: {
      name: p.familyDoctor || appointments[0]?.doctorName || 'Primary Physician',
      specialty: appointments[0]?.specialty || 'General Medicine',
      phone: '—',
      hospital: p.preferredHospital || appointments[0]?.hospital || 'Registered Hospital',
    },
    geofenceStatus: 'Inside Safe Zone',
    currentLocation: p.lastKnownLocation || p.address || 'Home',
    lastLocationUpdate: p.lastLocationUpdatedAt
      ? new Date(p.lastLocationUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Synced',
    overallStatus: vitals[0]?.status === 'critical' ? 'Alert' : vitals[0]?.status === 'elevated' ? 'Needs Attention' : 'Stable',
    accessLevel: (link?.accessLevel as any) || 'Full Legal Guardian',
    vitals,
    medications,
    appointments,
    careRequests: p.careRequests || [],
    notes: [],
  };
}

export const useCaregiverWorkflow = () => {
  const [wards, setWards] = useState<WardDependent[]>([]);
  const [activeWardId, setActiveWardId] = useState<string>('');
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [notifications, setNotifications] = useState<CaregiverNotification[]>([]);

  const refreshAll = useCallback(async () => {
    try {
      const [wardsRes, tasksRes, notifRes] = await Promise.all([
        caregiverApi.getWards().catch(() => null),
        caregiverApi.getTasks().catch(() => null),
        notificationApi.getNotifications().catch(() => null),
      ]);

      let mappedWards: WardDependent[] = [];
      if (wardsRes?.data && Array.isArray(wardsRes.data)) {
        mappedWards = wardsRes.data.map(mapBackendWard);
        // Hydrate persisted ward notes + SOS alerts for each ward
        const extras = await Promise.all(
          mappedWards.map(async (w) => {
            const [notesRes, sosRes] = await Promise.all([
              caregiverApi.getWardNotes(w.id).catch(() => null),
              patientClinicalApi.getSosAlerts(w.id).catch(() => null),
            ]);
            return {
              wardId: w.id,
              wardName: w.name,
              notes: Array.isArray(notesRes?.data)
                ? notesRes.data.map((n: any) => ({
                    id: n.id,
                    date: new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                    time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    author: n.caregiver?.fullName || 'Caregiver',
                    text: n.content,
                    tag: n.category || 'Caregiver Note',
                  }))
                : [],
              sos: Array.isArray(sosRes?.data)
                ? sosRes.data.map((s: any) => ({
                    id: s.id,
                    wardId: w.id,
                    wardName: w.name,
                    timestamp: new Date(s.triggeredAt).getTime(),
                    type: (s.eventType || 'SOS Panic Button') as EmergencyAlert['type'],
                    location: s.locationLabel || w.currentLocation,
                    status: s.status === 'RESOLVED' ? 'Resolved' : s.status === 'DISPATCHED' ? 'Dispatched' : 'Active',
                  }))
                : [],
            };
          })
        );

        const noteMap = new Map(extras.map((e) => [e.wardId, e.notes]));
        mappedWards = mappedWards.map((w) => ({ ...w, notes: noteMap.get(w.id) || [] }));
        setAlerts(extras.flatMap((e) => e.sos as EmergencyAlert[]));
      }
      setWards(mappedWards);
      setActiveWardId((prev) => (prev && mappedWards.some((w) => w.id === prev) ? prev : mappedWards[0]?.id || ''));

      if (tasksRes?.data && Array.isArray(tasksRes.data)) {
        setTasks(
          tasksRes.data.map((t: any) => ({
            id: t.id,
            wardId: t.patientId,
            title: t.title,
            category: (t.category || 'Medication') as any,
            time: t.scheduledTime || '09:00 AM',
            priority: String(t.priority || 'normal').toLowerCase() === 'high' ? 'high' : String(t.priority || 'normal').toLowerCase() === 'low' ? 'low' : 'medium',
            completed: t.status === 'Completed',
            status: (t.status || 'Pending') as CareTaskStatus,
            completedAt: t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            assignedTo: 'Caregiver',
            notes: t.notes || '',
          }))
        );
      }

      if (notifRes?.data && Array.isArray(notifRes.data)) {
        setNotifications(
          notifRes.data.map((n: any) => ({
            id: n.id,
            dependentId: mappedWards[0]?.id || '',
            title: n.title,
            message: n.message,
            type: 'General Caregiver Alert',
            timestamp: n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Recent',
            read: Boolean(n.isRead),
            priority: n.type === 'ALERT' ? 'high' : 'normal',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load caregiver workflow from MySQL:', err);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const handleSync = () => refreshAll();
    window.addEventListener('medicare_caregiver_sync', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('medicare_caregiver_sync', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [refreshAll]);

  const activeWard = wards.find((w) => w.id === activeWardId) || wards[0] || EMPTY_WARD;

  const triggerSync = () => window.dispatchEvent(new Event('medicare_caregiver_sync'));

  const toggleMedicationTaken = async (wardId: string, medId: string) => {
    const ward = wards.find((w) => w.id === wardId);
    const med = ward?.medications.find((m) => m.id === medId);
    const nextTaken = !med?.takenToday;
    try {
      await medicineApi.recordDoseLog({
        doseId: `${medId}-${new Date().toISOString().slice(0, 10)}`,
        medicineId: medId,
        status: nextTaken ? 'taken' : 'upcoming',
      });
    } catch {}
    setWards((prev) =>
      prev.map((w) =>
        w.id !== wardId
          ? w
          : {
              ...w,
              medications: w.medications.map((m) =>
                m.id !== medId
                  ? m
                  : {
                      ...m,
                      takenToday: nextTaken,
                      takenAt: nextTaken ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                    }
              ),
            }
      )
    );
    triggerSync();
  };

  const addVitalReading = async (
    wardId: string,
    reading: Omit<VitalRecord, 'id' | 'date' | 'time' | 'status'> & { status?: 'normal' | 'elevated' | 'critical' }
  ) => {
    await caregiverApi.logVital({
      patientId: wardId,
      systolicBp: reading.systolic,
      diastolicBp: reading.diastolic,
      heartRate: reading.heartRate,
      oxygenSaturation: reading.spo2,
      temperature: reading.temperature,
      bloodSugar: reading.bloodSugar,
      weightKg: reading.weight,
      notes: reading.notes || 'Caregiver recorded vitals',
    });
    await refreshAll();
    triggerSync();
  };

  const requestMedicationRefill = async (wardId: string, medId: string) => {
    const ward = wards.find((w) => w.id === wardId) || activeWard;
    const med = ward?.medications.find((m) => m.id === medId);
    const targetWardId = wardId || ward?.id;
    if (!targetWardId) return;

    // 1. Try creating a real pharmacy order if ward has an active prescription & available pharmacy
    let orderCreated = false;
    try {
      const [recordsRes, pharmaciesRes] = await Promise.all([
        caregiverApi.getWardRecords(targetWardId).catch(() => null),
        pharmacyApi.getAvailablePharmacies().catch(() => null),
      ]);
      const prescriptions = recordsRes?.data?.prescriptions || [];
      const matchingRx = prescriptions.find((rx: any) =>
        (rx.items || []).some((it: any) =>
          med?.name ? String(it.medicineName || '').toLowerCase().includes(med.name.toLowerCase()) : true
        )
      ) || prescriptions[0];
      const pharmacy = Array.isArray(pharmaciesRes?.data) ? pharmaciesRes.data[0] : null;
      if (matchingRx?.id && pharmacy?.id) {
        await pharmacyApi.createPharmacyOrder({
          prescriptionId: matchingRx.id,
          pharmacyId: pharmacy.id,
          deliveryAddress: ward?.currentLocation || 'Patient Residence',
          deliveryType: 'Home Delivery',
        });
        orderCreated = true;
      }
    } catch (err) {
      console.warn('Direct pharmacy refill order unavailable, logging refill task in MySQL:', err);
    }

    // 2. Always persist a caregiver refill task in MySQL so the action is durably tracked
    await caregiverApi.createTask({
      patientId: targetWardId,
      title: `Medication Refill${med?.name ? `: ${med.name}` : ''}`,
      category: 'Medication',
      scheduledTime: 'ASAP',
      priority: 'high',
      notes: orderCreated
        ? `Pharmacy refill order dispatched for ${med?.name || medId} (${med?.dosage || ''}).`
        : `Refill requested for ${med?.name || medId} (${med?.dosage || ''}).`,
    });

    await refreshAll();
    triggerSync();
  };

  const updateTaskStatus = async (taskId: string, status: CareTaskStatus) => {
    await caregiverApi.updateTask(taskId, { status });
    await refreshAll();
    triggerSync();
  };

  const startTask = (taskId: string) => updateTaskStatus(taskId, 'In Progress');
  const reopenTask = (taskId: string) => updateTaskStatus(taskId, 'Pending');

  const toggleTask = async (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    const nextStatus: CareTaskStatus = t?.completed ? 'Pending' : 'Completed';
    await updateTaskStatus(taskId, nextStatus);
  };

  const addTask = async (task: Omit<CareTask, 'id' | 'completed'>) => {
    await caregiverApi.createTask({
      patientId: task.wardId || activeWard.id,
      title: task.title,
      category: task.category,
      scheduledTime: task.time,
      priority: task.priority,
      notes: task.notes || task.instructions || '',
    });
    await refreshAll();
    triggerSync();
  };

  const triggerSOS = async (wardId: string, type: EmergencyAlert['type'] = 'SOS Panic Button') => {
    const ward = wards.find((w) => w.id === wardId) || activeWard;
    const res = await patientClinicalApi.triggerSosAlert({
      patientId: ward.id,
      eventType: type,
      locationLabel: ward.currentLocation,
      notes: `Triggered by caregiver for ${ward.name}`,
    });
    await refreshAll();
    triggerSync();
    return res?.data;
  };

  const resolveSOS = async (alertId: string) => {
    await patientClinicalApi.resolveSosAlert(alertId);
    await refreshAll();
    triggerSync();
  };

  const addNote = async (wardId: string, text: string, tag: string = 'Caregiver Note') => {
    await caregiverApi.createWardNote({
      patientId: wardId,
      category: tag,
      content: text,
    });
    await refreshAll();
    triggerSync();
  };

  const addAppointment = async (
    wardId: string,
    apt: Omit<WardAppointment, 'id' | 'status'> & { doctorId?: string }
  ) => {
    const targetWardId = wardId || activeWard.id;
    let resolvedDoctorId = apt.doctorId;

    if (!resolvedDoctorId) {
      const searchName = apt.doctorName?.replace(/^Dr\.?\s*/i, '').trim();
      const docRes = await appointmentApi.getDoctors(searchName || undefined).catch(() => null);
      const doctorsList = Array.isArray(docRes?.data) ? docRes.data : [];
      if (doctorsList.length > 0) {
        resolvedDoctorId = doctorsList[0].id;
      } else {
        const allDocsRes = await appointmentApi.getDoctors().catch(() => null);
        if (Array.isArray(allDocsRes?.data) && allDocsRes.data.length > 0) {
          resolvedDoctorId = allDocsRes.data[0].id;
        }
      }
    }

    if (!resolvedDoctorId) {
      throw new Error('No registered doctor available to book this appointment.');
    }

    await appointmentApi.createAppointment({
      doctorId: resolvedDoctorId,
      patientId: targetWardId,
      appointmentDate: apt.date,
      slotTime: apt.time || '10:00 AM',
      type: apt.mode === 'Video Consultation' ? 'VIDEO' : 'IN_PERSON',
      reason: apt.notes || `${apt.specialty || 'General'} Consultation`,
      notes: apt.notes || '',
    } as any);

    await refreshAll();
    triggerSync();
  };

  const addWard = async (
    wardData: Omit<
      WardDependent,
      'id' | 'vitals' | 'medications' | 'appointments' | 'notes' | 'geofenceStatus' | 'currentLocation' | 'lastLocationUpdate' | 'overallStatus'
    >
  ) => {
    await caregiverApi.addDependent({
      name: wardData.name,
      relationship: wardData.relationship,
      emergencyContact: wardData.emergencyContact,
    });
    await refreshAll();
    triggerSync();
  };

  const markNotificationRead = async (id: string) => {
    await notificationApi.markAsRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    window.dispatchEvent(new Event('notifications_updated'));
  };

  const markAllNotificationsRead = async (_targetWardId?: string) => {
    await notificationApi.markAllAsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new Event('notifications_updated'));
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return {
    wards,
    activeWardId,
    setActiveWardId,
    activeWard,
    tasks,
    alerts,
    notifications,
    unreadNotificationsCount,
    refreshAll,
    markNotificationRead,
    markAllNotificationsRead,
    toggleTask,
    updateTaskStatus,
    startTask,
    reopenTask,
    toggleMedicationTaken,
    requestMedicationRefill,
    addVitalReading,
    triggerSOS,
    resolveSOS,
    addNote,
    addTask,
    addAppointment,
    addWard,
  };
};
