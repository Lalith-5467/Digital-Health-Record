export interface HospitalAdminRecord {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  contactPhone: string;
  email: string;
  adminName: string;
  adminEmail: string;
  bedCapacity: number;
  activeDoctors: number;
  activeNurses: number;
  activePatients: number;
  activePharmacists: number;
  activeCaregivers: number;
  insurancePartnersCount: number;
  status: 'Active' | 'Under Review' | 'Suspended';
  establishedYear: number;
  accreditation: string;
  departments: string[];
}
