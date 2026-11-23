import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Settings2, ShieldCheck, CreditCard, Users,
  Bell, Unplug, Shield, FileText, CheckCircle2, Search,
  Upload, Save, RotateCcw, AlertTriangle, ArrowRight,
  Mail, Globe, Lock, Loader2
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { insuranceApi, profileApi, uploadApi } from '../../../services/dhrApis';

type SettingsSection =
  | 'profile' | 'claim-config' | 'pre-auth' | 'network'
  | 'settlement' | 'users' | 'notifications' | 'integrations'
  | 'security' | 'audit';

interface TpaProfileState {
  providerName: string;
  tpaId: string;
  licenseNumber: string;
  contactPerson: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
  logoUrl: string;
}

interface WorkflowPrefsState {
  autoClaimAssignment: boolean;
  claimReviewRequired: boolean;
  medicalReviewRequired: boolean;
  autoEscalation: boolean;
  enableCashlessPreAuth: boolean;
  autoEligibilityCheck: boolean;
  hospitalVerificationRequired: boolean;
  medicalReviewerApproval: boolean;
  emergencyCasePriority: boolean;
  preAuthSlaHours: number;
  hospitalOnboardingApproval: boolean;
  cashlessAvailabilityDefault: boolean;
  hospitalDocVerification: boolean;
  contractExpiryAlerts: boolean;
  settlementApprovalRequired: boolean;
  financeReviewRequired: boolean;
  autoSettlement: boolean;
  settlementSlaDays: number;
  defaultPaymentMethod: string;
}

interface SecurityPrefsState {
  twoFactorAuth: boolean;
  strongPasswordPolicy: boolean;
  sessionTimeoutMinutes: number;
  loginActivityTracking: boolean;
  failedLoginAlerts: boolean;
  suspiciousActivityAlerts: boolean;
  auditLogging: boolean;
}

type NotificationRowConfig = { inApp: boolean; email: boolean; sms: boolean };
type NotificationPrefsState = Record<string, NotificationRowConfig>;

const NOTIFICATION_EVENTS = [
  'Claim Submitted',
  'Claim Approved',
  'Claim Rejected',
  'Cashless Pre-Auth Approved',
  'Cashless Pre-Auth Rejected',
  'Settlement Completed',
  'Payment Failed',
  'Hospital Network Status Changed',
  'SLA Breach Alert',
];

const DEFAULT_WORKFLOW_PREFS: WorkflowPrefsState = {
  autoClaimAssignment: true,
  claimReviewRequired: true,
  medicalReviewRequired: true,
  autoEscalation: true,
  enableCashlessPreAuth: true,
  autoEligibilityCheck: true,
  hospitalVerificationRequired: true,
  medicalReviewerApproval: true,
  emergencyCasePriority: true,
  preAuthSlaHours: 4,
  hospitalOnboardingApproval: true,
  cashlessAvailabilityDefault: false,
  hospitalDocVerification: true,
  contractExpiryAlerts: true,
  settlementApprovalRequired: true,
  financeReviewRequired: true,
  autoSettlement: false,
  settlementSlaDays: 3,
  defaultPaymentMethod: 'NEFT',
};

const DEFAULT_SECURITY_PREFS: SecurityPrefsState = {
  twoFactorAuth: true,
  strongPasswordPolicy: true,
  sessionTimeoutMinutes: 30,
  loginActivityTracking: true,
  failedLoginAlerts: true,
  suspiciousActivityAlerts: true,
  auditLogging: true,
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsState = NOTIFICATION_EVENTS.reduce((acc, ev) => {
  acc[ev] = { inApp: true, email: true, sms: false };
  return acc;
}, {} as NotificationPrefsState);

const DEFAULT_PROFILE: TpaProfileState = {
  providerName: '',
  tpaId: '',
  licenseNumber: '',
  contactPerson: '',
  supportEmail: '',
  supportPhone: '',
  officeAddress: '',
  logoUrl: '',
};

const safeJsonParse = <T,>(raw: any, fallback: T): T => {
  if (!raw) return fallback;
  if (typeof raw === 'object') return { ...fallback, ...raw };
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
};

export const InsuranceSettingsView: React.FC = () => {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [searchNav, setSearchNav] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<TpaProfileState>(DEFAULT_PROFILE);
  const [tpaConfig, setTpaConfig] = useState({ autoApprovalThreshold: 25000, slaHours: 24 });
  const [workflowPrefs, setWorkflowPrefs] = useState<WorkflowPrefsState>(DEFAULT_WORKFLOW_PREFS);
  const [securityPrefs, setSecurityPrefs] = useState<SecurityPrefsState>(DEFAULT_SECURITY_PREFS);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefsState>(DEFAULT_NOTIFICATION_PREFS);
  const [networkCount, setNetworkCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<Array<{ date: string; user: string; action: string; module: string; status: string }>>([]);

  // Keep loaded snapshot for Reset Changes
  const [snapshot, setSnapshot] = useState<{
    profile: TpaProfileState;
    tpaConfig: { autoApprovalThreshold: number; slaHours: number };
    workflowPrefs: WorkflowPrefsState;
    securityPrefs: SecurityPrefsState;
    notificationPrefs: NotificationPrefsState;
  } | null>(null);

  const loadSettingsFromDb = async () => {
    setLoading(true);
    try {
      const [settingsRes, profRes, hospRes] = await Promise.all([
        insuranceApi.getTpaSettings().catch(() => null),
        profileApi.getInsuranceProfile().catch(() => null),
        insuranceApi.getNetworkHospitals().catch(() => null),
      ]);

      const loadedProfile: TpaProfileState = {
        providerName: profRes?.data?.providerName || '',
        tpaId: profRes?.data?.tpaId || '',
        licenseNumber: profRes?.data?.licenseNumber || '',
        contactPerson: profRes?.data?.contactPerson || '',
        supportEmail: profRes?.data?.supportEmail || profRes?.data?.email || '',
        supportPhone: profRes?.data?.supportPhone || '',
        officeAddress: profRes?.data?.officeAddress || '',
        logoUrl: profRes?.data?.logoUrl || '',
      };

      const rawSettings = settingsRes?.data || {};
      const loadedConfig = {
        autoApprovalThreshold: Number(rawSettings.autoApprovalThreshold ?? 25000),
        slaHours: Number(rawSettings.slaHours ?? 24),
      };
      const loadedWorkflow = safeJsonParse<WorkflowPrefsState>(rawSettings.workflowPrefsJson, DEFAULT_WORKFLOW_PREFS);
      const loadedSecurity = safeJsonParse<SecurityPrefsState>(rawSettings.securityPrefsJson, DEFAULT_SECURITY_PREFS);
      const loadedNotifs = safeJsonParse<NotificationPrefsState>(rawSettings.notificationPrefsJson, DEFAULT_NOTIFICATION_PREFS);

      setProfile(loadedProfile);
      setTpaConfig(loadedConfig);
      setWorkflowPrefs(loadedWorkflow);
      setSecurityPrefs(loadedSecurity);
      setNotificationPrefs(loadedNotifs);
      setSnapshot({
        profile: loadedProfile,
        tpaConfig: loadedConfig,
        workflowPrefs: loadedWorkflow,
        securityPrefs: loadedSecurity,
        notificationPrefs: loadedNotifs,
      });

      if (Array.isArray(hospRes?.data)) {
        setNetworkCount(hospRes.data.length);
      }

      if (rawSettings.updatedAt) {
        const dt = new Date(rawSettings.updatedAt);
        setLastSyncedAt(dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
        setRecentActivity([
          {
            date: dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            user: loadedProfile.contactPerson || loadedProfile.providerName || 'TPA Administrator',
            action: `TPA Settings Synchronized (SLA: ${loadedConfig.slaHours}h, Auto-Approval: ₹${loadedConfig.autoApprovalThreshold.toLocaleString('en-IN')})`,
            module: 'TPA Config',
            status: 'Saved',
          },
        ]);
      } else {
        setRecentActivity([]);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load TPA settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsFromDb();
  }, []);

  const markDirty = () => {
    setHasUnsavedChanges(true);
    setSavedSuccess(null);
    setErrorMsg(null);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploadRes = await uploadApi.uploadImage(file, 'INSURANCE_LOGO');
      if (uploadRes?.data?.url) {
        setProfile((prev) => ({ ...prev, logoUrl: uploadRes.data.url }));
        markDirty();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to upload logo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await Promise.all([
        insuranceApi.updateTpaSettings({
          autoApprovalThreshold: Number(tpaConfig.autoApprovalThreshold) || 0,
          slaHours: Number(tpaConfig.slaHours) || 24,
          workflowPrefs,
          notificationPrefs,
          securityPrefs,
        }),
        profileApi.updateInsuranceProfile({
          providerName: profile.providerName || undefined,
          tpaId: profile.tpaId || null,
          licenseNumber: profile.licenseNumber || null,
          contactPerson: profile.contactPerson || null,
          supportEmail: profile.supportEmail || null,
          supportPhone: profile.supportPhone || null,
          officeAddress: profile.officeAddress || null,
          logoUrl: profile.logoUrl || null,
        }),
      ]);

      await loadSettingsFromDb();
      setSavedSuccess('TPA settings saved to database');
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save TPA settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (snapshot) {
      setProfile(snapshot.profile);
      setTpaConfig(snapshot.tpaConfig);
      setWorkflowPrefs(snapshot.workflowPrefs);
      setSecurityPrefs(snapshot.securityPrefs);
      setNotificationPrefs(snapshot.notificationPrefs);
    }
    setHasUnsavedChanges(false);
    setErrorMsg(null);
  };

  const updateWorkflow = <K extends keyof WorkflowPrefsState>(key: K, val: WorkflowPrefsState[K]) => {
    setWorkflowPrefs((prev) => ({ ...prev, [key]: val }));
    markDirty();
  };

  const updateSecurity = <K extends keyof SecurityPrefsState>(key: K, val: SecurityPrefsState[K]) => {
    setSecurityPrefs((prev) => ({ ...prev, [key]: val }));
    markDirty();
  };

  const updateNotif = (eventName: string, channel: keyof NotificationRowConfig, val: boolean) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [eventName]: {
        ...(prev[eventName] || { inApp: true, email: true, sms: false }),
        [channel]: val,
      },
    }));
    markDirty();
  };

  const Toggle = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`w-10 h-5.5 rounded-full p-0.5 cursor-pointer transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0'}`} />
    </button>
  );

  const navGroups = [
    {
      title: 'Organization',
      items: [{ id: 'profile' as SettingsSection, icon: Building2, label: 'TPA Profile' }],
    },
    {
      title: 'Operations',
      items: [
        { id: 'claim-config' as SettingsSection, icon: Settings2, label: 'Claim Configuration' },
        { id: 'pre-auth' as SettingsSection, icon: ShieldCheck, label: 'Pre-Authorization' },
        { id: 'network' as SettingsSection, icon: Building2, label: 'Network Hospitals' },
        { id: 'settlement' as SettingsSection, icon: CreditCard, label: 'Settlement & Payouts' },
      ],
    },
    {
      title: 'Access',
      items: [{ id: 'users' as SettingsSection, icon: Users, label: 'Users & Roles' }],
    },
    {
      title: 'Communication',
      items: [{ id: 'notifications' as SettingsSection, icon: Bell, label: 'Notifications' }],
    },
    {
      title: 'Integrations',
      items: [{ id: 'integrations' as SettingsSection, icon: Unplug, label: 'API & Services' }],
    },
    {
      title: 'Security',
      items: [
        { id: 'security' as SettingsSection, icon: Shield, label: 'Security Settings' },
        { id: 'audit' as SettingsSection, icon: FileText, label: 'Audit Logs' },
      ],
    },
  ];

  const filteredNavGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => !searchNav.trim() || item.label.toLowerCase().includes(searchNav.toLowerCase())
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 pb-28 font-sans select-none max-w-7xl mx-auto">

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[2rem] bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('TPA Desk Settings')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t('Configure TPA operations, claim workflows, network access, settlements, notifications, and security.')}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {hasUnsavedChanges ? t('Unsaved changes') : lastSyncedAt ? `Synced ${lastSyncedAt}` : t('All settings are up to date')}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={saving || !hasUnsavedChanges}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t('Reset Changes')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? t('Saving...') : t('Save Changes')}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. DUAL PANE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT SIDEBAR NAVIGATION */}
        <div className="lg:col-span-3 sticky top-24 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchNav}
              onChange={(e) => setSearchNav(e.target.value)}
              placeholder={t('Search settings...')}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 dark:text-white transition-all shadow-sm"
            />
          </div>

          <nav className="space-y-1">
            {filteredNavGroups.map((group, gi) => (
              <React.Fragment key={group.title}>
                <div className={`${gi === 0 ? 'pt-2' : 'pt-4'} pb-1 px-3`}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.title}
                  </span>
                </div>
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    icon={item.icon}
                    label={item.label}
                    current={activeSection}
                    onClick={setActiveSection}
                  />
                ))}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* RIGHT MAIN CONTENT PANEL */}
        <div className="lg:col-span-9 bg-white dark:bg-[#0b1120] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm min-h-[600px] overflow-hidden">
          {loading ? (
            <div className="h-[500px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs font-bold">Loading TPA configuration from database...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeSection === 'profile' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">TPA Organization</h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Update your official Third Party Administrator details.</p>
                    </div>

                    <div className="flex items-center gap-6 pb-8 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 gap-2 overflow-hidden relative">
                        {profile.logoUrl ? (
                          <img src={profile.logoUrl} alt="TPA Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-8 h-8 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Upload TPA Logo</p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoChange}
                          className="hidden"
                          accept="image/png, image/jpeg"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" /> Change Logo
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputGroup
                        label="TPA Organization Name"
                        value={profile.providerName}
                        placeholder="Enter TPA organization name"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, providerName: v })); markDirty(); }}
                      />
                      <InputGroup
                        label="TPA ID"
                        value={profile.tpaId}
                        placeholder="e.g. TPA-019"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, tpaId: v })); markDirty(); }}
                      />
                      <InputGroup
                        label="Registration Number"
                        value={profile.licenseNumber}
                        placeholder="e.g. IRDAI-HLT-9921"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, licenseNumber: v })); markDirty(); }}
                      />
                      <InputGroup
                        label="Contact Person"
                        value={profile.contactPerson}
                        placeholder="Enter primary TPA contact"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, contactPerson: v })); markDirty(); }}
                      />
                      <InputGroup
                        label="Official Email"
                        type="email"
                        value={profile.supportEmail}
                        placeholder="support@tpa.in"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, supportEmail: v })); markDirty(); }}
                      />
                      <InputGroup
                        label="Support Phone"
                        value={profile.supportPhone}
                        placeholder="+91 1800-000-0000"
                        onChange={(v: string) => { setProfile((p) => ({ ...p, supportPhone: v })); markDirty(); }}
                      />
                      <div className="md:col-span-2">
                        <InputGroup
                          label="Office Address"
                          value={profile.officeAddress}
                          placeholder="Registered TPA office address"
                          onChange={(v: string) => { setProfile((p) => ({ ...p, officeAddress: v })); markDirty(); }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'claim-config' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-blue-500" /> Claim Processing Configuration
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Configure rules and workflows for claim adjudication.</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">Claim Workflow Engine</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-800/50">Submitted</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">Document Verification</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">Medical Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">Approval</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">Settlement</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SettingRow
                        label="Automatic Claim Assignment"
                        desc="Auto-route incoming claims based on SLA and availability."
                        Toggle={<Toggle checked={workflowPrefs.autoClaimAssignment} onToggle={() => updateWorkflow('autoClaimAssignment', !workflowPrefs.autoClaimAssignment)} />}
                      />
                      <SettingRow
                        label="Claim Review Required"
                        desc="Enforce manual desk review for all standard claims."
                        Toggle={<Toggle checked={workflowPrefs.claimReviewRequired} onToggle={() => updateWorkflow('claimReviewRequired', !workflowPrefs.claimReviewRequired)} />}
                      />
                      <SettingRow
                        label="Medical Review Required"
                        desc="Flag complex inpatient claims to Medical Adjudicators."
                        Toggle={<Toggle checked={workflowPrefs.medicalReviewRequired} onToggle={() => updateWorkflow('medicalReviewRequired', !workflowPrefs.medicalReviewRequired)} />}
                      />
                      <SettingRow
                        label="Auto Escalation"
                        desc="Escalate claims nearing SLA breaches to senior officers."
                        Toggle={<Toggle checked={workflowPrefs.autoEscalation} onToggle={() => updateWorkflow('autoEscalation', !workflowPrefs.autoEscalation)} />}
                      />

                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Claim SLA Target</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Maximum permitted time for adjudication.</p>
                        </div>
                        <select
                          value={tpaConfig.slaHours}
                          onChange={(e) => {
                            setTpaConfig((prev) => ({ ...prev, slaHours: Number(e.target.value) }));
                            markDirty();
                          }}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value={24}>24 Hours</option>
                          <option value={48}>48 Hours</option>
                          <option value={72}>72 Hours</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Max Claim Amount for Auto Approval</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">Threshold for fast-track automated approvals.</p>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            value={tpaConfig.autoApprovalThreshold}
                            onChange={(e) => {
                              setTpaConfig((prev) => ({ ...prev, autoApprovalThreshold: Number(e.target.value) }));
                              markDirty();
                            }}
                            className="w-36 pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'pre-auth' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-500" /> Cashless Pre-Authorization
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Manage rules for hospital cashless requests.</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">Approval Workflow</p>
                      <div className="flex flex-col gap-2">
                        <WorkflowStep label="Hospital Request" />
                        <WorkflowStep label="Eligibility Check" />
                        <WorkflowStep label="Document Verification" />
                        <WorkflowStep label="Medical Review" />
                        <WorkflowStep label="Approve / Reject" active />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SettingRow
                        label="Enable Cashless Pre-Authorization"
                        desc="Allow network hospitals to submit cashless requests."
                        Toggle={<Toggle checked={workflowPrefs.enableCashlessPreAuth} onToggle={() => updateWorkflow('enableCashlessPreAuth', !workflowPrefs.enableCashlessPreAuth)} />}
                      />
                      <SettingRow
                        label="Auto Eligibility Check"
                        desc="Run ABDM background checks on incoming requests."
                        Toggle={<Toggle checked={workflowPrefs.autoEligibilityCheck} onToggle={() => updateWorkflow('autoEligibilityCheck', !workflowPrefs.autoEligibilityCheck)} />}
                      />
                      <SettingRow
                        label="Hospital Verification Required"
                        desc="Validate hospital network status before processing."
                        Toggle={<Toggle checked={workflowPrefs.hospitalVerificationRequired} onToggle={() => updateWorkflow('hospitalVerificationRequired', !workflowPrefs.hospitalVerificationRequired)} />}
                      />
                      <SettingRow
                        label="Medical Reviewer Approval"
                        desc="Require a certified physician to approve complex procedures."
                        Toggle={<Toggle checked={workflowPrefs.medicalReviewerApproval} onToggle={() => updateWorkflow('medicalReviewerApproval', !workflowPrefs.medicalReviewerApproval)} />}
                      />
                      <SettingRow
                        label="Emergency Case Priority"
                        desc="Route emergency tags to the top of the queue immediately."
                        Toggle={<Toggle checked={workflowPrefs.emergencyCasePriority} onToggle={() => updateWorkflow('emergencyCasePriority', !workflowPrefs.emergencyCasePriority)} />}
                      />

                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Pre-Auth SLA</p>
                        </div>
                        <select
                          value={workflowPrefs.preAuthSlaHours}
                          onChange={(e) => updateWorkflow('preAuthSlaHours', Number(e.target.value))}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value={2}>2 Hours</option>
                          <option value={4}>4 Hours</option>
                          <option value={8}>8 Hours</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'network' && (
                  <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-500" /> Network Hospital Configuration
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Manage how {networkCount} registered network hospitals interact with your TPA desk.
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-cyan-400 text-xs font-black border border-blue-200 dark:border-blue-800/50">
                        {networkCount} Network Hospitals
                      </span>
                    </div>

                    <div className="space-y-4">
                      <SettingRow
                        label="Hospital Onboarding Approval"
                        desc="Require manual verification before a hospital joins network."
                        Toggle={<Toggle checked={workflowPrefs.hospitalOnboardingApproval} onToggle={() => updateWorkflow('hospitalOnboardingApproval', !workflowPrefs.hospitalOnboardingApproval)} />}
                      />
                      <SettingRow
                        label="Cashless Availability Default"
                        desc="Set newly onboarded hospitals to cashless enabled by default."
                        Toggle={<Toggle checked={workflowPrefs.cashlessAvailabilityDefault} onToggle={() => updateWorkflow('cashlessAvailabilityDefault', !workflowPrefs.cashlessAvailabilityDefault)} />}
                      />
                      <SettingRow
                        label="Hospital Document Verification"
                        desc="Enforce digital signature checks on submitted medical records."
                        Toggle={<Toggle checked={workflowPrefs.hospitalDocVerification} onToggle={() => updateWorkflow('hospitalDocVerification', !workflowPrefs.hospitalDocVerification)} />}
                      />
                      <SettingRow
                        label="Contract Expiry Alerts"
                        desc="Notify TPA admins 30 days before a hospital contract expires."
                        Toggle={<Toggle checked={workflowPrefs.contractExpiryAlerts} onToggle={() => updateWorkflow('contractExpiryAlerts', !workflowPrefs.contractExpiryAlerts)} />}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'settlement' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-500" /> Settlement Configuration
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Manage payouts and financial rules.</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-4">Settlement Workflow</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">Approved Claim</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">Financial Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">Settlement Approval</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">Payment Processing</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">Payment Completed</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SettingRow
                        label="Settlement Approval Required"
                        desc="Require final sign-off from TPA Admin."
                        Toggle={<Toggle checked={workflowPrefs.settlementApprovalRequired} onToggle={() => updateWorkflow('settlementApprovalRequired', !workflowPrefs.settlementApprovalRequired)} />}
                      />
                      <SettingRow
                        label="Finance Review Required"
                        desc="Mandatory ledger check by Finance Officer."
                        Toggle={<Toggle checked={workflowPrefs.financeReviewRequired} onToggle={() => updateWorkflow('financeReviewRequired', !workflowPrefs.financeReviewRequired)} />}
                      />
                      <SettingRow
                        label="Auto Settlement"
                        desc="Automatically disburse funds for approved claims under threshold."
                        Toggle={<Toggle checked={workflowPrefs.autoSettlement} onToggle={() => updateWorkflow('autoSettlement', !workflowPrefs.autoSettlement)} />}
                      />

                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Settlement SLA</p>
                        </div>
                        <select
                          value={workflowPrefs.settlementSlaDays}
                          onChange={(e) => updateWorkflow('settlementSlaDays', Number(e.target.value))}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value={1}>1 Business Day</option>
                          <option value={3}>3 Business Days</option>
                          <option value={7}>7 Business Days</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Default Payment Method</p>
                        </div>
                        <select
                          value={workflowPrefs.defaultPaymentMethod}
                          onChange={(e) => updateWorkflow('defaultPaymentMethod', e.target.value)}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="NEFT">NEFT</option>
                          <option value="RTGS">RTGS</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'users' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" /> Users & Roles
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Role capability definitions for TPA desk operations.</p>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-5 py-4">Role</th>
                            <th className="px-5 py-4">Permissions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                          <RoleRow name="TPA Admin" perms={['View', 'Create', 'Edit', 'Approve', 'Export']} />
                          <RoleRow name="Claims Officer" perms={['View', 'Create', 'Edit']} />
                          <RoleRow name="Medical Reviewer" perms={['View', 'Approve']} />
                          <RoleRow name="Finance Officer" perms={['View', 'Approve', 'Export']} />
                          <RoleRow name="Insurance Agent" perms={['View', 'Create']} />
                          <RoleRow name="Support Staff" perms={['View']} />
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSection === 'notifications' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-500" /> Notifications & Alerts
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Configure automatic system alerts for staff and partners.</p>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-5 py-4">Event Trigger</th>
                            <th className="px-5 py-4 text-center">In-App</th>
                            <th className="px-5 py-4 text-center">Email</th>
                            <th className="px-5 py-4 text-center">SMS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
                          {NOTIFICATION_EVENTS.map((ev) => {
                            const cfg = notificationPrefs[ev] || { inApp: true, email: true, sms: false };
                            return (
                              <NotificationRow
                                key={ev}
                                name={ev}
                                config={cfg}
                                onChange={(channel: keyof NotificationRowConfig, val: boolean) => updateNotif(ev, channel, val)}
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSection === 'integrations' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-500" /> API & Services
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Active backend clearinghouse services connected to MySQL.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <IntegrationCard name="Insurance Claims API" icon={ShieldCheck} status="Connected" time={lastSyncedAt || 'Live'} />
                      <IntegrationCard name="Hospital Network API" icon={Building2} status={`${networkCount} Linked`} time={lastSyncedAt || 'Live'} />
                      <IntegrationCard name="Settlement Gateway" icon={CreditCard} status={workflowPrefs.defaultPaymentMethod} time={lastSyncedAt || 'Live'} />
                      <IntegrationCard name="Notification Service" icon={Mail} status="Active" time={lastSyncedAt || 'Live'} />
                    </div>
                  </div>
                )}

                {activeSection === 'security' && (
                  <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Lock className="w-5 h-5 text-blue-500" /> Security Settings
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Manage authentication, access policies, and monitoring.</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Security Status: {securityPrefs.twoFactorAuth && securityPrefs.auditLogging ? 'Protected' : 'Custom'}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Authentication</h3>
                        <div className="space-y-2">
                          <SettingRow
                            label="Two-Factor Authentication (2FA)"
                            desc="Require OTP code for all admin logins."
                            Toggle={<Toggle checked={securityPrefs.twoFactorAuth} onToggle={() => updateSecurity('twoFactorAuth', !securityPrefs.twoFactorAuth)} />}
                          />
                          <SettingRow
                            label="Strong Password Policy"
                            desc="Enforce minimum 12 chars, symbols, and rotation."
                            Toggle={<Toggle checked={securityPrefs.strongPasswordPolicy} onToggle={() => updateSecurity('strongPasswordPolicy', !securityPrefs.strongPasswordPolicy)} />}
                          />
                          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">Session Timeout</p>
                            </div>
                            <select
                              value={securityPrefs.sessionTimeoutMinutes}
                              onChange={(e) => updateSecurity('sessionTimeoutMinutes', Number(e.target.value))}
                              className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                            >
                              <option value={15}>15 Minutes</option>
                              <option value={30}>30 Minutes</option>
                              <option value={60}>1 Hour</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Security Monitoring</h3>
                        <div className="space-y-2">
                          <SettingRow
                            label="Login Activity Tracking"
                            desc="Monitor location and device for all logins."
                            Toggle={<Toggle checked={securityPrefs.loginActivityTracking} onToggle={() => updateSecurity('loginActivityTracking', !securityPrefs.loginActivityTracking)} />}
                          />
                          <SettingRow
                            label="Failed Login Alerts"
                            desc="Notify admins after 5 consecutive failed attempts."
                            Toggle={<Toggle checked={securityPrefs.failedLoginAlerts} onToggle={() => updateSecurity('failedLoginAlerts', !securityPrefs.failedLoginAlerts)} />}
                          />
                          <SettingRow
                            label="Suspicious Activity Alerts"
                            desc="Detection alerts for anomalous data exports."
                            Toggle={<Toggle checked={securityPrefs.suspiciousActivityAlerts} onToggle={() => updateSecurity('suspiciousActivityAlerts', !securityPrefs.suspiciousActivityAlerts)} />}
                          />
                          <SettingRow
                            label="Audit Logging"
                            desc="Immutable record of all system configuration changes."
                            Toggle={<Toggle checked={securityPrefs.auditLogging} onToggle={() => updateSecurity('auditLogging', !securityPrefs.auditLogging)} />}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'audit' && (
                  <div className="p-8 space-y-8">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" /> Audit Logs
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Live configuration audit history for this TPA desk.</p>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-5 py-4">Date & Time</th>
                            <th className="px-5 py-4">User</th>
                            <th className="px-5 py-4">Action</th>
                            <th className="px-5 py-4">Module</th>
                            <th className="px-5 py-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
                          {recentActivity.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-10 text-center text-xs font-bold text-slate-400">
                                No configuration changes recorded yet. Save settings to log an entry.
                              </td>
                            </tr>
                          ) : (
                            recentActivity.map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="px-5 py-4 text-slate-500">{row.date}</td>
                                <td className="px-5 py-4 text-slate-900 dark:text-white font-bold">{row.user}</td>
                                <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{row.action}</td>
                                <td className="px-5 py-4"><span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-black uppercase">{row.module}</span></td>
                                <td className="px-5 py-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">{row.status}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* STICKY SAVE BAR */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-[#070c18] border border-slate-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-white">You have unsaved changes</p>
                <p className="text-[10px] text-slate-400 font-medium">Please save or discard to continue.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-slate-700 pl-6">
              <button onClick={handleReset} className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer">Discard Changes</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        )}

        {savedSuccess && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto select-auto bg-emerald-500 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white"
            >
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-black">{savedSuccess}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

const NavItem = ({ id, icon: Icon, label, current, onClick }: any) => {
  const { t } = useLanguage();
  const isActive = current === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-cyan-400 font-bold shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium'
      }`}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-cyan-400' : ''}`} />
      {t(label)}
    </button>
  );
};

const InputGroup = ({ label, value, onChange, type = 'text', placeholder }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
    />
  </div>
);

const SettingRow = ({ label, desc, Toggle }: any) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/80">
    <div>
      <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
      <p className="text-xs text-slate-500 font-medium mt-0.5">{desc}</p>
    </div>
    {Toggle}
  </div>
);

const WorkflowStep = ({ label, active }: any) => (
  <div className="flex flex-col items-center justify-center">
    <div className={`px-4 py-2 rounded-xl text-xs font-bold border ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-cyan-400 border-blue-200 dark:border-blue-800/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
      {label}
    </div>
    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 my-1"></div>
  </div>
);

const RoleRow = ({ name, perms }: any) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
    <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{name}</td>
    <td className="px-5 py-4 flex flex-wrap gap-1.5">
      {perms.map((p: string, i: number) => (
        <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 rounded">
          {p}
        </span>
      ))}
    </td>
  </tr>
);

const NotificationRow = ({ name, config, onChange }: any) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{name}</td>
    <td className="px-5 py-3 text-center">
      <input
        type="checkbox"
        checked={Boolean(config.inApp)}
        onChange={(e) => onChange('inApp', e.target.checked)}
        className="w-4 h-4 cursor-pointer accent-blue-600"
      />
    </td>
    <td className="px-5 py-3 text-center">
      <input
        type="checkbox"
        checked={Boolean(config.email)}
        onChange={(e) => onChange('email', e.target.checked)}
        className="w-4 h-4 cursor-pointer accent-blue-600"
      />
    </td>
    <td className="px-5 py-3 text-center">
      <input
        type="checkbox"
        checked={Boolean(config.sms)}
        onChange={(e) => onChange('sms', e.target.checked)}
        className="w-4 h-4 cursor-pointer accent-blue-600"
      />
    </td>
  </tr>
);

const IntegrationCard = ({ name, icon: Icon, status, time }: any) => (
  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-4 hover:border-blue-500/30 transition-colors">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#070c18] border border-slate-200 dark:border-slate-700 flex items-center justify-center">
        <Icon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{status}</span>
        </div>
      </div>
    </div>
    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
      <span className="text-[10px] text-slate-500 font-medium">Last synced: {time}</span>
      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Online</span>
    </div>
  </div>
);
