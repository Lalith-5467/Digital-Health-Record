import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Bell, Shield, LogOut, ChevronDown, UserCheck,
  HelpCircle, Search, ShieldCheck, KeyRound, Sparkles, Check,
  AlertTriangle, Lock, User, FileText, Calendar, Activity,
  Pill, Send, RefreshCw, Loader2, CheckCircle2
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { AdminSidebar } from '../components/admin-dashboard/AdminSidebar';

// SUB-VIEWS
import { AdminDashboardHomeView } from '../components/admin-dashboard/views/AdminDashboardHomeView';
import { AdminHospitalManagementView } from '../components/admin-dashboard/views/AdminHospitalManagementView';
import { AdminUserManagementView } from '../components/admin-dashboard/views/AdminUserManagementView';
import { AdminRolesPermissionsView } from '../components/admin-dashboard/views/AdminRolesPermissionsView';
import { SuperAdminManagementView } from '../components/admin-dashboard/views/SuperAdminManagementView';
import { SuperAdminHealthVideoView } from '../components/admin-dashboard/views/SuperAdminHealthVideoView';
import { AdminPatientManagementView } from '../components/admin-dashboard/views/AdminPatientManagementView';
import { AdminStaffManagementView } from '../components/admin-dashboard/views/AdminStaffManagementView';
import { AdminOperationsView } from '../components/admin-dashboard/views/AdminOperationsView';
import { AdminSecurityAuditView } from '../components/admin-dashboard/views/AdminSecurityAuditView';
import { AdminSystemSettingsView } from '../components/admin-dashboard/views/AdminSystemSettingsView';
import { AdminReportsAnalyticsView } from '../components/admin-dashboard/views/AdminReportsAnalyticsView';
import { AdminProfileSettingsView } from '../components/admin-dashboard/views/AdminProfileSettingsView';
import { NotificationPopover } from '../components/dashboard/NotificationPopover';
import { DashboardAnnouncementBanner } from '../components/common/DashboardAnnouncementBanner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { adminExtendedApi, notificationApi, profileApi } from '../services/dhrApis';
import { getAuthToken, parseJwtRole } from '../services/apiClient';

interface AdminDashboardPageProps {
  user?: {
    name?: string;
    email?: string;
    role?: string;
  };
  initialNavId?: string;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  user,
  initialNavId = 'dashboard',
  onLogout,
  onNavigate
}) => {
  const getInitialAdminRole = (): 'Admin' | 'Super Admin' => {
    const token = getAuthToken();
    if (token) {
      const role = parseJwtRole(token);
      if (role === 'SUPER_ADMIN') return 'Super Admin';
      if (role === 'ADMIN') return 'Admin';
    }
    const propRole = (user?.role || '').toUpperCase();
    if (propRole === 'SUPER_ADMIN' || propRole.includes('SUPER')) return 'Super Admin';
    return 'Admin';
  };

  const currentRole: 'Admin' | 'Super Admin' = getInitialAdminRole();
  const [activeNavId, setActiveNavId] = useState<string>(initialNavId);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [notificationPopoverOpen, setNotificationPopoverOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  React.useEffect(() => {
    if (initialNavId) {
      setActiveNavId(initialNavId);
    }
  }, [initialNavId]);

  const loadUnreadCount = async () => {
    try {
      const res = await notificationApi.getNotifications();
      if (res && res.data) {
        setUnreadNotificationsCount(res.data.filter((n: any) => !n.isRead).length);
      }
    } catch { }
  };

  React.useEffect(() => {
    loadUnreadCount();
    const handleUpdate = () => loadUnreadCount();
    window.addEventListener('notifications_updated', handleUpdate);
    return () => window.removeEventListener('notifications_updated', handleUpdate);
  }, []);

  const [currentAdminUser, setCurrentAdminUser] = useState<any>(user || null);

  useEffect(() => {
    const loadProfile = () => {
      profileApi
        .getProfile()
        .then((res) => {
          if (res?.data) {
            const d: any = res.data;
            setCurrentAdminUser({
              name: d.fullName || d.profile?.fullName || d.email?.split('@')[0],
              email: d.email,
              role: d.role,
            });
          }
        })
        .catch(() => {});
    };
    loadProfile();
    window.addEventListener('app_user_updated', loadProfile);
    return () => window.removeEventListener('app_user_updated', loadProfile);
  }, []);

  const rawAdminName =
    (currentAdminUser?.name && currentAdminUser.name.trim()) ||
    (user?.name && user.name.trim()) ||
    currentRole;
  const adminName =
    rawAdminName.toLowerCase() === 'system administrator' ||
    rawAdminName.toLowerCase() === 'hospital administrator'
      ? (currentRole === 'Super Admin' ? 'Super Admin' : 'Admin')
      : rawAdminName;
  const adminEmail = currentAdminUser?.email || user?.email || '';

  const SUPER_ADMIN_ONLY_VIEWS = [
    'admin-management',
    'roles-permissions',
    'security-audit',
    'backup-recovery'
  ];

  const handleSelectNav = (id: string) => {
    if (id === 'home') {
      if (onNavigate) {
        onNavigate('home');
      }
      return;
    }

    setActiveNavId(id);
    localStorage.setItem('admin_active_nav_id', id);

    const targetUrl = `/admin/${id}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  };

  const isRestricted = currentRole === 'Admin' && SUPER_ADMIN_ONLY_VIEWS.includes(activeNavId);

  const renderContent = () => {
    if (isRestricted) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-6 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Super Admin Access Required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              This administrative module contains system-wide security, role assignment, and firewall policies. Please elevate your credentials to Super Admin.
            </p>
          </div>
          <p className="text-xs font-bold text-slate-400">
            Sign in with a verified Super Admin account to access governance controls.
          </p>
        </div>
      );
    }

    switch (activeNavId) {
      case 'dashboard':
        return <AdminDashboardHomeView onNavigate={handleSelectNav} currentRole={currentRole} />;
      case 'hospitals':
        return (
          <ErrorBoundary>
            <AdminHospitalManagementView
              onLaunchHospitalPortal={(hospital) => {
                if (onNavigate) {
                  window.history.pushState(null, '', `/hospital/dashboard?hospitalId=${encodeURIComponent(hospital.id)}`);
                  onNavigate('hospital/dashboard');
                }
              }}
            />
          </ErrorBoundary>
        );
      case 'users':
        return <AdminUserManagementView />;
      case 'patients':
        return <AdminPatientManagementView />;
      case 'doctors':
        return <AdminStaffManagementView type="doctor" />;
      case 'nurses':
        return <AdminStaffManagementView type="nurse" />;
      case 'pharmacists':
        return <AdminStaffManagementView type="pharmacist" />;
      case 'caregivers':
        return <AdminStaffManagementView type="caregiver" />;
      case 'insurance':
        return <AdminOperationsView type="insurance" />;
      case 'pharmacy-orders':
        return <AdminOperationsView type="pharmacy" />;
      case 'prescriptions':
      case 'medical-records':
      case 'appointments':
      case 'vitals-monitoring':
        return <AdminClinicalOverviewPanel activeSection={activeNavId} />;
      case 'notifications-dispatch':
        return <AdminNotificationsDispatchPanel />;
      case 'admin-management':
        return <SuperAdminManagementView currentRole={currentRole} />;
      case 'roles-permissions':
        return <AdminRolesPermissionsView currentRole={currentRole} />;
      case 'health-videos':
        return <SuperAdminHealthVideoView currentRole={currentRole} />;
      case 'security-audit':
      case 'backup-recovery':
      case 'activity-logs':
        return <AdminSecurityAuditView currentRole={currentRole} />;
      case 'reports-analytics':
        return <AdminReportsAnalyticsView />;
      case 'profile':
      case 'profile-settings':
        return <AdminProfileSettingsView user={user} currentRole={currentRole} />;
      case 'system-config':
      case 'settings':
        return <AdminSystemSettingsView currentRole={currentRole} />;
      default:
        return <AdminDashboardHomeView onNavigate={handleSelectNav} currentRole={currentRole} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-[#070c18] text-slate-900 dark:text-white font-sans flex flex-col select-none">

      {/* 1. TOP EXECUTIVE HEADER */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button
            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <Logo />
            <div className="hidden sm:flex items-center gap-2 pl-3 ml-3 border-l border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-teal-700 dark:text-cyan-300 bg-teal-500/10 dark:bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-teal-500/20">
                {currentRole} Portal
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* DARK / LIGHT THEME TOGGLE */}
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setNotificationPopoverOpen(true)}
            className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-sm">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

          {/* PROFILE DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm text-white bg-[#00a896] shadow-xs">
                {adminName.charAt(0)}
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 hidden md:block">{adminName}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            <AnimatePresence>
              {isProfileDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 space-y-1 text-xs font-bold"
                >
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="font-black text-slate-900 dark:text-white">{adminName}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{adminEmail}</p>
                  </div>

                  <button
                    onClick={() => {
                      handleSelectNav('profile');
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#00a896]" /> My Profile & Settings
                  </button>

                  <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Verified Role
                    </span>
                    <span className="text-[9px] font-mono font-bold text-teal-600 dark:text-cyan-400">
                      {currentRole}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout Session
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT WITH SIDEBAR AND MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* DESKTOP SIDEBAR */}
        <div className="hidden lg:block shrink-0">
          <AdminSidebar
            activeId={activeNavId}
            onSelectNav={handleSelectNav}
            currentRole={currentRole}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* MOBILE SIDEBAR */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-[#0b1120] shadow-2xl"
              >
                <AdminSidebar
                  activeId={activeNavId}
                  onSelectNav={(id) => {
                    handleSelectNav(id);
                    setMobileSidebarOpen(false);
                  }}
                  currentRole={currentRole}
                  isCollapsed={false}
                  onToggleCollapse={() => { }}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MAIN SCROLL CONTAINER */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#070c18] p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeNavId}-${currentRole}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto h-full"
            >
              <DashboardAnnouncementBanner role={currentRole === 'Super Admin' ? 'superAdmin' : 'admin'} />
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <NotificationPopover
        isOpen={notificationPopoverOpen}
        onClose={() => setNotificationPopoverOpen(false)}
        onNavigateToNotifications={() => {
          setNotificationPopoverOpen(false);
          handleSelectNav('activity-logs');
        }}
      />
    </div>
  );
};

// ==========================================
// REAL DB-BACKED CLINICAL OVERVIEW PANEL
// ==========================================
const AdminClinicalOverviewPanel: React.FC<{ activeSection: string }> = ({ activeSection }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadClinical = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminExtendedApi.getClinicalOverview();
      setData(res?.data || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load clinical overview from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinical();
  }, [activeSection]);

  const counts = data?.counts || {
    prescriptions: 0,
    medicalRecords: 0,
    appointments: 0,
    vitals: 0,
    careRequests: 0,
    insuranceClaims: 0,
    pharmacyOrders: 0,
  };

  const sectionMeta: Record<string, { title: string; subtitle: string }> = {
    prescriptions: {
      title: 'Clinical Prescriptions Registry',
      subtitle: 'Live prescriptions issued across all doctors and patients in MySQL.',
    },
    'medical-records': {
      title: 'Medical Records & Clinical Vault',
      subtitle: 'Centralized repository of patient medical records, diagnostic reports, and clinical summaries.',
    },
    appointments: {
      title: 'Appointments & Consultations Log',
      subtitle: 'Real-time consultation schedule and appointment audit across the hospital network.',
    },
    'vitals-monitoring': {
      title: 'Vitals & Clinical Telemetry Overview',
      subtitle: 'Aggregated clinical counts for vitals logs, care requests, prescriptions, and records.',
    },
  };

  const meta = sectionMeta[activeSection] || sectionMeta.appointments;
  const q = searchTerm.trim().toLowerCase();

  const recentPrescriptions: any[] = (data?.recentPrescriptions || []).filter(
    (p: any) =>
      !q ||
      String(p.diagnosis || '').toLowerCase().includes(q) ||
      String(p.patient?.fullName || '').toLowerCase().includes(q) ||
      String(p.doctor?.fullName || '').toLowerCase().includes(q)
  );

  const recentRecords: any[] = (data?.recentRecords || []).filter(
    (r: any) =>
      !q ||
      String(r.title || '').toLowerCase().includes(q) ||
      String(r.type || '').toLowerCase().includes(q) ||
      String(r.patient?.fullName || '').toLowerCase().includes(q)
  );

  const recentAppointments: any[] = (data?.recentAppointments || []).filter(
    (a: any) =>
      !q ||
      String(a.patient?.fullName || '').toLowerCase().includes(q) ||
      String(a.doctor?.fullName || '').toLowerCase().includes(q) ||
      String(a.status || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl bg-[#00a896] text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{meta.title}</h2>
          <p className="text-sm text-teal-50/90 font-medium mt-1">{meta.subtitle}</p>
        </div>
        <button
          onClick={loadClinical}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-white text-[#00796b] font-black text-xs shadow-md flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Live Data
        </button>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">Prescriptions</span>
            <Pill className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{counts.prescriptions}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">Medical Records</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{counts.medicalRecords}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">Appointments</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{counts.appointments}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold">Vitals Logged</span>
            <Activity className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{counts.vitals}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
          {error}
        </div>
      )}

      {/* SEARCH */}
      {activeSection !== 'vitals-monitoring' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter records by patient, doctor, or title..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
          />
        </div>
      )}

      {/* DATA TABLE */}
      <div className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-14 flex items-center justify-center gap-2 text-slate-500 text-sm font-bold">
            <Loader2 className="w-5 h-5 animate-spin text-[#00a896]" /> Loading clinical database records...
          </div>
        ) : activeSection === 'prescriptions' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-5">Patient</th>
                  <th className="py-3.5 px-4">Prescribing Doctor</th>
                  <th className="py-3.5 px-4">Diagnosis</th>
                  <th className="py-3.5 px-4">Medicines</th>
                  <th className="py-3.5 px-4">Issued</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentPrescriptions.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">No prescriptions found in database.</td></tr>
                ) : (
                  recentPrescriptions.map((rx: any) => (
                    <tr key={rx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{rx.patient?.fullName || 'Patient'}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">{rx.doctor?.fullName || 'Doctor'}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{rx.diagnosis || 'General'}</td>
                      <td className="py-3.5 px-4 font-mono">{Array.isArray(rx.items) ? rx.items.length : 0} items</td>
                      <td className="py-3.5 px-4 text-slate-500">{rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-teal-600 dark:text-teal-400">{rx.status || 'ACTIVE'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeSection === 'medical-records' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-5">Record Title</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Hospital</th>
                  <th className="py-3.5 px-4">Record Date</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentRecords.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">No medical records found in database.</td></tr>
                ) : (
                  recentRecords.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{rec.title}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">{rec.patient?.fullName || 'Patient'}</td>
                      <td className="py-3.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold">{rec.type}</span></td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{rec.hospital || 'Not Recorded'}</td>
                      <td className="py-3.5 px-4 text-slate-500">{rec.recordDate ? new Date(rec.recordDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-emerald-600 dark:text-emerald-400">{rec.status || 'VERIFIED'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeSection === 'appointments' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-black tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-5">Patient</th>
                  <th className="py-3.5 px-4">Doctor</th>
                  <th className="py-3.5 px-4">Date & Slot</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Fee</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentAppointments.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">No appointments found in database.</td></tr>
                ) : (
                  recentAppointments.map((apt: any) => (
                    <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{apt.patient?.fullName || 'Patient'}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {apt.doctor?.fullName || 'Doctor'} {apt.doctor?.speciality ? `(${apt.doctor.speciality})` : ''}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} • {apt.slotTime || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono">{apt.type || 'IN_PERSON'}</td>
                      <td className="py-3.5 px-4 font-bold">₹{Number(apt.fee || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-5 text-right font-bold text-blue-600 dark:text-cyan-400">{apt.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500">Total Vitals Entries Recorded</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{counts.vitals}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500">Home & Nurse Care Requests</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{counts.careRequests}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500">Insurance Claims / Pharmacy Orders</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {counts.insuranceClaims} / {counts.pharmacyOrders}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// REAL DB-BACKED BROADCAST NOTIFICATION FORM
// ==========================================
const AdminNotificationsDispatchPanel: React.FC = () => {
  const [targetRole, setTargetRole] = useState<string>('ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'INFO' | 'ALERT' | 'SUCCESS'>('INFO');
  const [category, setCategory] = useState('Admin Broadcast');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await adminExtendedApi.dispatchNotification({
        targetRole,
        title: title.trim(),
        message: message.trim(),
        type,
        category: category.trim() || 'Admin Broadcast',
      });
      const dispatched = res?.data?.dispatched ?? 0;
      setFeedback({ kind: 'success', text: `Broadcast persisted & dispatched to ${dispatched} active user(s) in MySQL.` });
      setTitle('');
      setMessage('');
      window.dispatchEvent(new Event('notifications_updated'));
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'Failed to dispatch notification.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-3xl mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl bg-[#00a896] text-white shadow-lg">
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6" /> Broadcast Notifications Dispatch
        </h2>
        <p className="text-sm text-teal-50/90 font-medium mt-1">
          Send real-time system alerts and clinical advisories directly to active portal users in MySQL.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            feedback.kind === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          {feedback.kind === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <form
        onSubmit={handleDispatch}
        className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Target Audience</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
            >
              <option value="ALL">All Active Users</option>
              <option value="PATIENT">Patients Only</option>
              <option value="DOCTOR">Doctors Only</option>
              <option value="NURSE">Nurses Only</option>
              <option value="PHARMACIST">Pharmacists Only</option>
              <option value="CAREGIVER">Caregivers Only</option>
              <option value="INSURANCE_PROVIDER">Insurance Providers Only</option>
              <option value="ADMIN">Administrators Only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Alert Severity</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
            >
              <option value="INFO">Information (INFO)</option>
              <option value="SUCCESS">Announcement (SUCCESS)</option>
              <option value="ALERT">Urgent Advisory (ALERT)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. System Maintenance, Clinical Advisory"
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Notification Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter broadcast headline..."
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Message Body *</label>
          <textarea
            rows={4}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the full notification message to dispatch to recipients..."
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00a896]"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-[#00a896] hover:bg-[#00897b] text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{submitting ? 'Dispatching...' : 'Dispatch Broadcast Notification'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
