// Pure TypeScript types & ephemeral in-memory workflow banner helper (ZERO localStorage business storage).
import type { MedicineItem } from '../components/medicines/medicinesData';
import type { ReminderItem } from '../components/reminders/remindersData';
import type { PharmacyOrder } from '../components/pharmacy/pharmacyData';

export interface ExtendedMedicineItem extends MedicineItem {
  sourcePrescriptionId?: string;
  doctorName?: string;
  hospitalName?: string;
}

export interface ExtendedReminderItem extends ReminderItem {
  sourcePrescriptionId?: string;
  doctorName?: string;
  clinicName?: string;
  followUpStatus?: 'Pending' | 'Accepted' | 'Declined';
  followUpDate?: string;
}

export interface ExtendedPharmacyOrder extends PharmacyOrder {
  orderNumber?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  prescriptionId?: string;
  sourcePrescriptionId?: string;
  doctorName?: string;
  clinicName?: string;
  pharmacyAddress?: string;
  subtotal?: number;
  taxAmount?: number;
  deliveryFee?: number;
  declineReason?: string;
  pharmacistNotes?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  statusTimeline?: Record<string, string | null>;
}

export interface WorkflowConfirmationResult {
  prescriptionId?: string;
  prescription?: any;
  orderId?: string;
  pharmacyOrder?: ExtendedPharmacyOrder | any;
  reminderCreated?: boolean;
  reminderItem?: ExtendedReminderItem | any;
  patientName?: string;
  doctorName?: string;
  hospitalName?: string;
  pharmacyName?: string;
  medicinesCount?: number;
  remindersCount?: number;
  confirmedAt?: string;
}

let latestEphemeralWorkflow: WorkflowConfirmationResult | null = null;

export function getLatestWorkflow(): WorkflowConfirmationResult | null {
  return latestEphemeralWorkflow;
}

export function setLatestWorkflow(res: WorkflowConfirmationResult | null): void {
  latestEphemeralWorkflow = res;
}

export function clearLatestWorkflowResult(): void {
  latestEphemeralWorkflow = null;
}

export function getPharmacyOrders(): ExtendedPharmacyOrder[] {
  return [];
}
