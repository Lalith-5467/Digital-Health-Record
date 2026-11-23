// Type definitions only — all hospital & admin data is persisted strictly in MySQL via adminApi.
export type { HospitalAdminRecord } from '../types/hospital';

export function getStoredHospitals(): import('../types/hospital').HospitalAdminRecord[] {
  return [];
}
