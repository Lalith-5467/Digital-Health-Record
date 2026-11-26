import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Stethoscope, HeartPulse, Pill, HeartHandshake,
  ShieldCheck, LogOut, Search, Bed, Activity, Phone,
  Mail, MapPin, Award, CheckCircle2, ChevronDown, Filter, Calendar,
  Menu, X, Lock, KeyRound, AlertTriangle
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { adminApi, adminExtendedApi } from '../services/dhrApis';
import type { HospitalAdminRecord } from '../types/hospital';
import { AdminStaffManagementView } from '../components/admin-dashboard/views/AdminStaffManagementView';
import { AdminPatientManagementView } from '../components/admin-dashboard/views/AdminPatientManagementView';
import { AdminOperationsView } from '../components/admin-dashboard/views/AdminOperationsView';

interface HospitalDashboardPageProps {
  user?: {
    name?: string;
    email?: string;
    role?: string;
  };
  initialHospitalId?: string;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

export const HospitalDashboardPage: React.FC<HospitalDashboardPageProps> = ({
  user,
  initialHospitalId,
  onLogout,
  onNavigate: _onNavigate,
}) => {
  const [hospitals, setHospitals] = useState<HospitalAdminRecord[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalAdminRecord | null>(null);
  const [loadingHospitals, setLoadingHospitals] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'doctors' | 'nurses' | 'patients' | 'pharmacists' | 'caregivers' | 'insurance'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Live real data from database
  const [liveDoctors, setLiveDoctors] = useState<any[]>([]);
  const [liveNurses, setLiveNurses] = useState<any[]>([]);
  const [livePatients, setLivePatients] = useState<any[]>([]);
  const [livePharmacists, setLivePharmacists] = useState<any[]>([]);
  const [liveCaregivers, setLiveCaregivers] = useState<any[]>([]);
  const [liveInsurance, setLiveInsurance] = useState<any[]>([]);
  const [clinicalCounts, setClinicalCounts] = useState<{
    appointments: number;
    prescriptions: number;
    medicalRecords: number;
    vitals: number;
    insuranceClaims: number;
    pharmacyOrders: number;
  }>({
    appointments: 0,
    prescriptions: 0,
    medicalRecords: 0,
    vitals: 0,
    insuranceClaims: 0,
    pharmacyOrders: 0,
  });

  const syncHospitalDirectory = async () => {
    setLoadingHospitals(true);
    try {
      const res = await adminApi.getHospitals();
      const list: HospitalAdminRecord[] = res?.data && Array.isArray(res.data) ? res.data : [];
      setHospitals(list);

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const qId = urlParams?.get('hospitalId') || initialHospitalId;
      const userEmail = (user?.email || '').toLowerCase();

      let chosen: HospitalAdminRecord | undefined;
      if (qId) {
        chosen = list.find(
          (h) => h.id === qId || h.hospitalId === qId || h.code?.toLowerCase() === qId.toLowerCase()
        );
      }
      if (!chosen && userEmail) {
        chosen = list.find(
          (h) => h.adminEmail?.toLowerCase() === userEmail || h.email?.toLowerCase() === userEmail
        );
      }
      setSelectedHospital((prev) => {
        if (chosen) return chosen;
        if (prev) {
          const refreshed = list.find((h) => h.id === prev.id);
          if (refreshed) return refreshed;
        }
        return list[0] || null;
      });
    } catch {
      setHospitals([]);
      setSelectedHospital(null);
    } finally {
      setLoadingHospitals(false);
    }
  };

  useEffect(() => {
    syncHospitalDirectory();
    const handleHospitalUpdate = () => {
      syncHospitalDirectory();
    };
    window.addEventListener('admin_hospitals_updated', handleHospitalUpdate);
    return () => {
      window.removeEventListener('admin_hospitals_updated', handleHospitalUpdate);
    };
  }, [initialHospitalId, user?.email]);

  useEffect(() => {
    // Fetch live registered users and operational metrics directly from MySQL
    Promise.all([
      adminApi.getUsers({ limit: 100 }).catch(() => null),
      adminExtendedApi.getClinicalOverview().catch(() => null),
    ]).then(([usersRes, clinicalRes]) => {
      if (usersRes && usersRes.data) {
        const all: any[] = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data as any).users || [];
        setLiveDoctors(all.filter((u) => u.role === 'DOCTOR'));
        setLiveNurses(all.filter((u) => u.role === 'NURSE'));
        setLivePatients(all.filter((u) => u.role === 'PATIENT'));
        setLivePharmacists(all.filter((u) => u.role === 'PHARMACIST'));
        setLiveCaregivers(all.filter((u) => u.role === 'CAREGIVER'));
        setLiveInsurance(all.filter((u) => u.role === 'INSURANCE_PROVIDER' || u.role === 'INSURANCE'));
      }
      if (clinicalRes?.data?.counts) {
        setClinicalCounts({
          appointments: Number(clinicalRes.data.counts.appointments ?? 0),
          prescriptions: Number(clinicalRes.data.counts.prescriptions ?? 0),
          medicalRecords: Number(clinicalRes.data.counts.medicalRecords ?? 0),
          vitals: Number(clinicalRes.data.counts.vitals ?? 0),
          insuranceClaims: Number(clinicalRes.data.counts.insuranceClaims ?? 0),
          pharmacyOrders: Number(clinicalRes.data.counts.pharmacyOrders ?? 0),
        });
      }
    });
  }, []);

  if (loadingHospitals) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070c18] text-slate-900 dark:text-white">
        <div className="text-center space-y-3">
          <Building2 className="w-12 h-12 text-teal-500 mx-auto animate-pulse" />
          <h2 className="text-lg font-bold">Loading Hospital Portal from Database...</h2>
        </div>
      </div>
    );
  }

  if (!selectedHospital) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070c18] text-slate-900 dark:text-white p-6">
        <div className="text-center space-y-4 max-w-md bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-black">No Registered Hospital Facilities</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hospital records were found in the database. Onboard a hospital facility from the Admin Portal first.
          </p>
          <button
            onClick={onLogout}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Helper to strictly match user's affiliated hospital
  const matchesSelectedHospital = (userItem: any, hosp: HospitalAdminRecord) => {
    if (!hosp || !userItem) return false;
    const targetHospName = hosp.name.toLowerCase().trim();
    const targetHospId = (hosp.id || hosp.hospitalId || '').toLowerCase().trim();
    const targetHospCode = (hosp.code || '').toLowerCase().trim();
    
    // Check all possible hospital fields on the user / profile objects
    const affiliations: string[] = [
      userItem.hospital,
      userItem.doctor?.hospital,
      userItem.nurse?.hospital,
      userItem.pharmacist?.hospital,
      userItem.pharmacist?.pharmacyName,
      userItem.pharmacist?.hospitalId,
      userItem.pharmacist?.hospitalRef?.name,
      userItem.pharmacist?.hospitalRef?.id,
      userItem.pharmacist?.pharmacy?.name,
      userItem.caregiver?.hospital,
      userItem.patient?.hospital,
      userItem.patient?.preferredHospital,
      userItem.patient?.hospitalId,
      userItem.patient?.hospitalRef?.name,
      userItem.patient?.hospitalRef?.id,
      userItem.profile?.hospital,
      userItem.profile?.preferredHospital,
      userItem.profile?.hospitalId,
    ].filter(Boolean).map(h => String(h).toLowerCase().trim());

    if (affiliations.length === 0) {
      // If user has no hospital assigned, only assign to default MediCare Central Hospital
      return targetHospName === 'medicare central hospital';
    }

    // Must match the hospital name, code, or ID
    return affiliations.some(aff => 
      aff === targetHospName ||
      (targetHospId && aff === targetHospId) ||
      (targetHospCode && aff === targetHospCode) ||
      (targetHospName.length > 5 && aff.startsWith(targetHospName)) ||
      (aff.length > 5 && targetHospName.startsWith(aff))
    );
  };

  // Real data calculations - filtered specifically to the selected hospital facility!
  const realDoctors = liveDoctors.filter(doc => matchesSelectedHospital(doc, selectedHospital));
  const realNurses = liveNurses.filter(nurse => matchesSelectedHospital(nurse, selectedHospital));
  const realPatients = livePatients.filter(pt => matchesSelectedHospital(pt, selectedHospital));
  const realPharmacists = livePharmacists.filter(ph => matchesSelectedHospital(ph, selectedHospital));
  const realCaregivers = liveCaregivers.filter(cg => matchesSelectedHospital(cg, selectedHospital));
  const realInsurance = liveInsurance.filter(ins => matchesSelectedHospital(ins, selectedHospital));

  const currentDepartments = Array.isArray(selectedHospital.departments) ? selectedHospital.departments : ['Emergency & Trauma', 'General Medicine', 'Outpatient OPD', 'Inpatient Ward', 'Cardiology', 'ICU Care'];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-[#070c18] text-slate-900 dark:text-white font-sans flex flex-col select-none">
      
      {/* 1. TOP HOSPITAL EXECUTIVE BAR */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md:hidden"
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black border border-teal-500/25">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {selectedHospital.name}
              </h1>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-500" />
                {selectedHospital.city}, {selectedHospital.state}
              </p>
            </div>
          </div>
        </div>

        {/* Executive Action Controls */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* 2. BODY WITH SIDEBAR AND MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* EXECUTIVE LEFT SIDEBAR */}
        <aside className={`w-64 bg-white dark:bg-[#0b1120] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-30 transition-all duration-300 md:static fixed inset-y-16 left-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-2">
              Facility Departments & Portals
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {[
              { id: 'overview', label: 'Overview & Facility Stats', icon: Activity, count: null },
              { id: 'doctors', label: 'Doctors', icon: Stethoscope, count: realDoctors.length },
              { id: 'nurses', label: 'Nurses', icon: HeartPulse, count: realNurses.length },
              { id: 'patients', label: 'Patients', icon: Users, count: realPatients.length },
              { id: 'pharmacists', label: 'Pharmacy Desk', icon: Pill, count: realPharmacists.length },
              { id: 'caregivers', label: 'Caregivers', icon: HeartHandshake, count: realCaregivers.length },
              { id: 'insurance', label: 'Insurance Desk', icon: ShieldCheck, count: realInsurance.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-900/15'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== null && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-200 text-[11px] font-semibold">
              <span className="block font-bold">ABDM Connected</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400">Live Hospital Node</span>
            </div>
          </div>
        </aside>

        {/* 3. MAIN BODY SCROLL CONTAINER */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#070c18] p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* HOSPITAL HERO CARD */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 text-white shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/20">
                      Hospital Management Portal
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black">{selectedHospital.name}</h2>
                    <p className="text-xs text-teal-50 max-w-xl">
                      {selectedHospital.address}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Phone className="w-3.5 h-3.5" /> {selectedHospital.contactPhone}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Mail className="w-3.5 h-3.5" /> {selectedHospital.email}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold bg-white/10 px-2 py-0.5 rounded-md">
                        <Award className="w-3.5 h-3.5 text-amber-300" /> {selectedHospital.accreditation}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0 text-center">
                    <span className="text-[10px] text-teal-100 font-bold uppercase block">
                      Licensed Bed Capacity
                    </span>
                    <span className="text-3xl font-black text-white">{selectedHospital.bedCapacity}</span>
                    <span className="text-[10px] text-teal-200 block mt-0.5">In-Patient & ICU</span>
                  </div>
                </div>
              </div>

              {/* STATS TILES */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div 
                  onClick={() => setActiveTab('doctors')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Doctors</span>
                    <Stethoscope className="w-4 h-4 text-teal-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realDoctors.length}</span>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 block mt-0.5">Active Staff</span>
                </div>

                <div 
                  onClick={() => setActiveTab('nurses')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Nurses</span>
                    <HeartPulse className="w-4 h-4 text-rose-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realNurses.length}</span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">Shift Duty</span>
                </div>

                <div 
                  onClick={() => setActiveTab('patients')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Patients</span>
                    <Users className="w-4 h-4 text-cyan-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realPatients.length}</span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block mt-0.5">Under Care</span>
                </div>

                <div 
                  onClick={() => setActiveTab('pharmacists')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Pharmacy</span>
                    <Pill className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realPharmacists.length}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">Dispensing</span>
                </div>

                <div 
                  onClick={() => setActiveTab('caregivers')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Caregivers</span>
                    <HeartHandshake className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realCaregivers.length}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block mt-0.5">Support</span>
                </div>

                <div 
                  onClick={() => setActiveTab('insurance')}
                  className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold">Insurance</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{realInsurance.length}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">TPA Partners</span>
                </div>
              </div>

              {/* LIVE OPERATIONAL TELEMETRY FROM MYSQL */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Appointments Logged</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{clinicalCounts.appointments}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Prescriptions Issued</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{clinicalCounts.prescriptions}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Medical Records Vault</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{clinicalCounts.medicalRecords}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Claims / Pharmacy Orders</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {clinicalCounts.insuranceClaims} / {clinicalCounts.pharmacyOrders}
                  </span>
                </div>
              </div>

              {/* CLINICAL DEPARTMENTS & FACILITY DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#0b1120] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-500" /> Active Medical Departments
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentDepartments.map((dept) => (
                      <span
                        key={dept}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0b1120] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" /> Administration Contacts
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">Medical Director / Admin</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedHospital.adminName}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{selectedHospital.adminEmail}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">Accreditation Level</span>
                      <span className="font-bold text-teal-600 dark:text-teal-400">{selectedHospital.accreditation}</span>
                      <span className="text-[10px] text-slate-500 block">Est. {selectedHospital.establishedYear}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'doctors' && (
            <AdminStaffManagementView type="doctor" defaultHospital={selectedHospital.name} />
          )}

          {activeTab === 'nurses' && (
            <AdminStaffManagementView type="nurse" defaultHospital={selectedHospital.name} />
          )}

          {activeTab === 'patients' && (
            <AdminPatientManagementView defaultHospital={selectedHospital.name} />
          )}

          {activeTab === 'pharmacists' && (
            <AdminStaffManagementView type="pharmacist" defaultHospital={selectedHospital.name} />
          )}

          {activeTab === 'caregivers' && (
            <AdminStaffManagementView type="caregiver" defaultHospital={selectedHospital.name} />
          )}

          {activeTab === 'insurance' && (
            <AdminOperationsView type="insurance" />
          )}
        </div>
      </main>
    </div>
  </div>
  );
};



