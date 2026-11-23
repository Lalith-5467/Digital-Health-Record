import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, ShieldCheck, Clock, Search, Filter, ArrowDownToLine,
  Plus, X, Calendar, User, Phone, Mail,
  MapPin, CheckCircle2, AlertTriangle, ActivitySquare, Loader2
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { insuranceApi } from '../../../services/dhrApis';

interface MappedPolicy {
  id: string;
  dbId: string;
  holder: string;
  memberId: string;
  provider: string;
  plan: string;
  type: string;
  coverageAmount: number;
  remainingCoverage: number;
  deductible: number;
  coPayPercent: number;
  roomRentLimit: string;
  coverage: string;
  premium: string;
  validUntil: string;
  policyEndDateRaw: string | null;
  status: string;
  dob: string;
  phone: string;
  email: string;
  city: string;
  members: Array<{ name: string; relation: string }>;
  claims: any[];
}

export const PoliciesDirectoryView: React.FC = () => {
  const { t } = useLanguage();
  const [policies, setPolicies] = useState<MappedPolicy[]>([]);
  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [networkHospitals, setNetworkHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPolicy, setSelectedPolicy] = useState<MappedPolicy | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'recent' | 'expiry' | 'coverage'>('recent');

  // Action Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreAuthModal, setShowPreAuthModal] = useState(false);
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create Policy Form State
  const [createPatientEmail, setCreatePatientEmail] = useState('');
  const [createPlanName, setCreatePlanName] = useState('Comprehensive Health Shield');
  const [createPolicyNumber, setCreatePolicyNumber] = useState('');
  const [createCoverageAmount, setCreateCoverageAmount] = useState('1000000');
  const [createDeductible, setCreateDeductible] = useState('0');
  const [createCoPay, setCreateCoPay] = useState('0');

  // Start Pre-Auth Form State
  const [preAuthHospital, setPreAuthHospital] = useState('');
  const [preAuthAmount, setPreAuthAmount] = useState('');
  const [preAuthDiagnosis, setPreAuthDiagnosis] = useState('');
  const [preAuthProcedure, setPreAuthProcedure] = useState('Cashless Admission');

  const handleAction = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const [polRes, clmRes, hospRes] = await Promise.all([
        insuranceApi.getPolicies().catch(() => null),
        insuranceApi.getClaims().catch(() => null),
        insuranceApi.getNetworkHospitals().catch(() => null),
      ]);

      const claimsList = Array.isArray(clmRes?.data) ? clmRes.data : [];
      setAllClaims(claimsList);

      if (Array.isArray(hospRes?.data)) {
        setNetworkHospitals(hospRes.data);
        if (hospRes.data[0]?.name && !preAuthHospital) {
          setPreAuthHospital(hospRes.data[0].name);
        }
      }

      if (polRes?.data && Array.isArray(polRes.data)) {
        const mapped: MappedPolicy[] = polRes.data.map((p: any) => {
          const endDate = p.policyEndDate ? new Date(p.policyEndDate) : null;
          const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
          let computedStatus = p.policyStatus || 'Active';
          if (computedStatus === 'Active' && daysLeft !== null) {
            if (daysLeft < 0) computedStatus = 'Expired';
            else if (daysLeft <= 30) computedStatus = 'Expiring Soon';
          }
          const policyClaims = Array.isArray(p.claims) && p.claims.length > 0
            ? p.claims
            : claimsList.filter((c: any) => c.policyId === p.id);

          return {
            id: p.policyNumber || p.insuranceId || p.id,
            dbId: p.id,
            holder: p.patient?.fullName || 'Policy Holder',
            memberId: p.insuranceId || p.id.slice(-8).toUpperCase(),
            provider: p.provider?.providerName || 'Health Insurance TPA',
            plan: p.policyName || 'Comprehensive Health Plan',
            type: Array.isArray(p.familyMembers) && p.familyMembers.length > 0 ? 'Family' : 'Individual',
            coverageAmount: Number(p.coverageAmount ?? 0),
            remainingCoverage: Number(p.remainingCoverage ?? p.coverageAmount ?? 0),
            deductible: Number(p.deductible ?? 0),
            coPayPercent: Number(p.coPayPercent ?? 0),
            roomRentLimit: p.roomRentLimit || 'Standard',
            coverage: `₹${Number(p.coverageAmount ?? 0).toLocaleString('en-IN')}`,
            premium: `₹${Number(p.remainingCoverage ?? 0).toLocaleString('en-IN')} rem.`,
            validUntil: endDate
              ? endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—',
            policyEndDateRaw: p.policyEndDate || null,
            status: computedStatus,
            dob: p.patient?.dateOfBirth
              ? new Date(p.patient.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Not Recorded',
            phone: p.patient?.user?.phoneNumber || 'Not Recorded',
            email: p.patient?.user?.email || 'Not Recorded',
            city: p.patient?.address || 'Not Recorded',
            members:
              Array.isArray(p.familyMembers) && p.familyMembers.length > 0
                ? p.familyMembers.map((m: any) => ({ name: m.name, relation: m.relationship }))
                : [{ name: p.patient?.fullName || 'Policy Holder', relation: 'Primary' }],
            claims: policyClaims,
          };
        });
        setPolicies(mapped);
        if (selectedPolicy) {
          const refreshed = mapped.find((m) => m.dbId === selectedPolicy.dbId) || null;
          setSelectedPolicy(refreshed);
        }
      } else {
        setPolicies([]);
      }
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  // Computed Metrics from Real DB Data
  const metrics = useMemo(() => {
    const total = policies.length;
    const active = policies.filter((p) => p.status === 'Active').length;
    const expiring = policies.filter((p) => p.status === 'Expiring Soon').length;
    const expiredOrInactive = policies.filter((p) => p.status === 'Expired' || p.status === 'Inactive' || p.status === 'Cancelled').length;

    const now = Date.now();
    const expire7 = policies.filter((p) => {
      if (!p.policyEndDateRaw) return false;
      const days = (new Date(p.policyEndDateRaw).getTime() - now) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    }).length;
    const expire15 = policies.filter((p) => {
      if (!p.policyEndDateRaw) return false;
      const days = (new Date(p.policyEndDateRaw).getTime() - now) / (1000 * 60 * 60 * 24);
      return days > 7 && days <= 15;
    }).length;
    const expire30 = policies.filter((p) => {
      if (!p.policyEndDateRaw) return false;
      const days = (new Date(p.policyEndDateRaw).getTime() - now) / (1000 * 60 * 60 * 24);
      return days > 15 && days <= 30;
    }).length;

    const familyCount = policies.filter((p) => p.type === 'Family').length;
    const individualCount = total - familyCount;

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return {
      total,
      active,
      expiring,
      expiredOrInactive,
      activePct: pct(active),
      expiringPct: pct(expiring),
      expiredPct: pct(expiredOrInactive),
      familyPct: pct(familyCount),
      individualPct: pct(individualCount),
      expire7,
      expire15,
      expire30,
      totalClaims: allClaims.length,
    };
  }, [policies, allClaims]);

  const uniqueProviders = useMemo(() => {
    return Array.from(new Set(policies.map((p) => p.provider).filter(Boolean)));
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = policies.filter((p) => {
      const matchesSearch =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.holder.toLowerCase().includes(q) ||
        p.memberId.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        p.plan.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchesProvider = providerFilter === 'All' || p.provider === providerFilter;
      return matchesSearch && matchesStatus && matchesProvider;
    });

    if (sortBy === 'coverage') {
      return [...list].sort((a, b) => b.coverageAmount - a.coverageAmount);
    }
    if (sortBy === 'expiry') {
      return [...list].sort((a, b) => {
        const ta = a.policyEndDateRaw ? new Date(a.policyEndDateRaw).getTime() : Infinity;
        const tb = b.policyEndDateRaw ? new Date(b.policyEndDateRaw).getTime() : Infinity;
        return ta - tb;
      });
    }
    return list;
  }, [policies, searchQuery, statusFilter, providerFilter, sortBy]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPatientEmail.trim()) {
      handleAction('Please enter the patient registered email.');
      return;
    }
    setSubmitting(true);
    try {
      await insuranceApi.createPolicy({
        patientEmail: createPatientEmail.trim().toLowerCase(),
        policyName: createPlanName.trim() || 'Comprehensive Health Shield',
        policyNumber: createPolicyNumber.trim() || undefined,
        coverageAmount: Number(createCoverageAmount) || 1000000,
        deductible: Number(createDeductible) || 0,
        coPayPercent: Number(createCoPay) || 0,
        policyStatus: 'Active',
      });
      setShowCreateModal(false);
      setCreatePatientEmail('');
      setCreatePolicyNumber('');
      setCreateCoverageAmount('1000000');
      setCreateDeductible('0');
      setCreateCoPay('0');
      await loadDirectory();
      handleAction('New policy created & persisted in MySQL.');
    } catch (err: any) {
      handleAction(err?.message || 'Failed to create policy. Ensure patient email exists.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartPreAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setSubmitting(true);
    try {
      const amount = Number(preAuthAmount) || 0;
      await insuranceApi.createPreAuthorization({
        policyId: selectedPolicy.dbId,
        hospitalName: preAuthHospital.trim() || 'Network Hospital',
        procedure: preAuthProcedure.trim() || 'Cashless Admission',
        diagnosis: preAuthDiagnosis.trim() || 'Pending clinical diagnosis',
        estimatedCost: amount,
        requestedAmount: amount,
      });
      setShowPreAuthModal(false);
      setPreAuthAmount('');
      setPreAuthDiagnosis('');
      handleAction('Pre-Authorization request submitted & saved to MySQL.');
    } catch (err: any) {
      handleAction(err?.message || 'Failed to submit pre-authorization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredPolicies.length === 0) {
      handleAction('No policies available to export.');
      return;
    }
    const headers = ['Policy ID', 'Holder', 'Member ID', 'Provider', 'Plan', 'Coverage', 'Valid Until', 'Status'];
    const rows = filteredPolicies.map((p) => [
      p.id, p.holder, p.memberId, p.provider, p.plan, p.coverageAmount, p.validUntil, p.status
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `policies-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    handleAction(`Exported ${filteredPolicies.length} policies as CSV.`);
  };

  const handleDownloadPolicySummary = () => {
    if (!selectedPolicy) return;
    const text = `INSURANCE POLICY SCHEDULE
Policy ID: ${selectedPolicy.id}
Member ID: ${selectedPolicy.memberId}
Holder: ${selectedPolicy.holder}
Email: ${selectedPolicy.email}
Provider: ${selectedPolicy.provider}
Plan: ${selectedPolicy.plan}
Coverage Amount: ${selectedPolicy.coverage}
Remaining Coverage: ₹${selectedPolicy.remainingCoverage.toLocaleString('en-IN')}
Valid Until: ${selectedPolicy.validUntil}
Status: ${selectedPolicy.status}
`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Policy-${selectedPolicy.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    handleAction('Policy summary downloaded.');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t('Active')}</span>;
      case 'Expiring Soon':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> {t('Expiring Soon')}</span>;
      case 'Expired':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {t('Expired')}</span>;
      case 'Pending':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> {t('Pending')}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> {t(status)}</span>;
    }
  };

  const renderDonutChart = (segments: { color: string; percentage: number }[]) => {
    let currentRotation = 0;
    return (
      <div className="relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
        {segments.map((segment, idx) => {
          const rotation = currentRotation;
          currentRotation += (segment.percentage / 100) * 360;
          return (
            <div
              key={idx}
              className="absolute inset-0 origin-center"
              style={{
                background: `conic-gradient(from ${rotation}deg, ${segment.color} 0%, ${segment.color} ${segment.percentage}%, transparent ${segment.percentage}%)`,
              }}
            />
          );
        })}
        <div className="absolute w-16 h-16 bg-white dark:bg-[#0b1120] rounded-full z-10" />
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-28 font-sans select-none max-w-7xl mx-auto">

      {/* TOAST NOTIFICATION */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto select-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm border border-slate-700 dark:border-slate-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-[2rem] bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('Policies Directory')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t('Search, review, and manage all insurance policies across your network.')}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Database ({metrics.total} Policies • {metrics.totalClaims} Claims)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> {t('Export Report')}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> {t('Create Policy', 'Create Policy')}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY CARDS (LIVE COMPUTED) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Policies', value: metrics.total.toLocaleString('en-IN'), icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', borderTop: 'border-t-blue-500', trend: `${metrics.totalClaims} linked claims` },
          { label: 'Active Policies', value: metrics.active.toLocaleString('en-IN'), icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', borderTop: 'border-t-emerald-500', trend: `${metrics.activePct}% of total` },
          { label: 'Expiring Soon', value: metrics.expiring.toLocaleString('en-IN'), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', borderTop: 'border-t-amber-500', trend: 'Within next 30 days' },
          { label: 'Expired / Inactive', value: metrics.expiredOrInactive.toLocaleString('en-IN'), icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', borderTop: 'border-t-rose-500', trend: `${metrics.expiredPct}% of total` },
        ].map((stat, i) => (
          <div
            key={i}
            className={`bg-white dark:bg-[#0b1120] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 border-t-2 ${stat.borderTop} shadow-sm hover:shadow-md transition-all flex flex-col justify-between group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-1.5">{stat.value}</p>
              <p className="text-xs text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">{t(stat.label)}</p>
              <p className="text-[10px] font-bold text-slate-400">{stat.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. ANALYTICS & ALERTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#0b1120] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row gap-8 items-center justify-around">
          <div className="flex items-center gap-6">
            {renderDonutChart([
              { color: '#10b981', percentage: metrics.activePct },
              { color: '#f59e0b', percentage: metrics.expiringPct },
              { color: '#f43f5e', percentage: metrics.expiredPct },
            ])}
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">Policy Distribution</h3>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active ({metrics.activePct}%)</li>
                <li className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Expiring Soon ({metrics.expiringPct}%)</li>
                <li className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Expired ({metrics.expiredPct}%)</li>
              </ul>
            </div>
          </div>

          <div className="hidden sm:block w-px h-full bg-slate-200 dark:bg-slate-800"></div>

          <div className="flex items-center gap-6">
            {renderDonutChart([
              { color: '#3b82f6', percentage: metrics.familyPct },
              { color: '#8b5cf6', percentage: metrics.individualPct },
            ])}
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">Coverage Type</h3>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Family ({metrics.familyPct}%)</li>
                <li className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Individual ({metrics.individualPct}%)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Expiry Alert Card */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-sm font-black text-amber-800 dark:text-amber-500 uppercase tracking-wider flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" /> Policies Expiring Soon
            </h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white mb-4">
              {metrics.expiring} <span className="text-sm font-medium text-slate-500">policies</span>
            </p>
            <ul className="space-y-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <li className="flex items-center justify-between"><span>Expire in 7 days</span> <span className="text-amber-600 dark:text-amber-500">{metrics.expire7}</span></li>
              <li className="flex items-center justify-between"><span>Expire in 15 days</span> <span className="text-amber-600 dark:text-amber-500">{metrics.expire15}</span></li>
              <li className="flex items-center justify-between"><span>Expire in 30 days</span> <span className="text-amber-600 dark:text-amber-500">{metrics.expire30}</span></li>
            </ul>
          </div>
          <button
            onClick={() => setStatusFilter('Expiring Soon')}
            className="w-full mt-6 py-2.5 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-400 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-amber-200 dark:border-amber-500/30"
          >
            Review Expiring Policies →
          </button>
        </div>
      </div>

      {/* 4. SEARCH & FILTER SECTION */}
      <div className="bg-white dark:bg-[#0b1120] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Policy ID, Patient Name, Member ID or Insurance Provider..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 dark:text-white transition-all shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="All">Provider: All</option>
            {uniqueProviders.map((prov) => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>

          <div className="flex-1"></div>

          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('All'); setProviderFilter('All'); }}
            className="px-4 py-2.5 text-xs font-bold text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* 5. ENTERPRISE POLICY TABLE */}
      <div className="bg-white dark:bg-[#0b1120] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> All Policies ({filteredPolicies.length})
          </h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-bold text-slate-500 bg-transparent outline-none cursor-pointer"
          >
            <option value="recent">Sort By: Recently Added</option>
            <option value="expiry">Sort By: Policy Expiry</option>
            <option value="coverage">Sort By: Coverage Amount</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Policy ID</th>
                <th className="px-6 py-4">Policy Holder</th>
                <th className="px-6 py-4">Provider & Plan</th>
                <th className="px-6 py-4">Coverage</th>
                <th className="px-6 py-4">Remaining</th>
                <th className="px-6 py-4">Valid Until</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Loading policies...</span>
                  </td>
                </tr>
              ) : filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                    No insurance policies found. Click "Create Policy" to add one.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((policy) => (
                  <tr
                    key={policy.dbId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors cursor-pointer" onClick={() => setSelectedPolicy(policy)}>
                        {policy.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{policy.holder}</p>
                      <p className="text-[10px] font-mono text-slate-500">{policy.memberId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{policy.provider}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{policy.type} • {policy.plan}</p>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-300">{policy.coverage}</td>
                    <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-300">{policy.premium}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{policy.validUntil}</td>
                    <td className="px-6 py-4">{getStatusBadge(policy.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedPolicy(policy)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800/50 rounded-lg transition-all cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>
            Showing {filteredPolicies.length > 0 ? 1 : 0}–{filteredPolicies.length} of {policies.length} policies
          </span>
        </div>
      </div>

      {/* 6. POLICY DETAILS MODAL */}
      <AnimatePresence>
        {selectedPolicy && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPolicy(null)}
              className="fixed inset-0 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm z-50 cursor-pointer"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
              >
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Policy {selectedPolicy.id}</h2>
                    {getStatusBadge(selectedPolicy.status)}
                  </div>
                  <button
                    onClick={() => setSelectedPolicy(null)}
                    className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Policy Holder</h3>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-500 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20 shrink-0">
                        {selectedPolicy.holder.charAt(0)}
                      </div>
                      <div className="space-y-1.5 w-full">
                        <p className="text-lg font-black text-slate-900 dark:text-white">{selectedPolicy.holder}</p>
                        <p className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit">Member ID: {selectedPolicy.memberId}</p>

                        <div className="grid grid-cols-2 gap-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"><Calendar className="w-3.5 h-3.5" /> {selectedPolicy.dob}</div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"><MapPin className="w-3.5 h-3.5" /> {selectedPolicy.city}</div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"><Phone className="w-3.5 h-3.5" /> {selectedPolicy.phone}</div>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"><Mail className="w-3.5 h-3.5" /> {selectedPolicy.email}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Coverage Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sum Insured</p>
                        <p className="text-base font-black text-slate-900 dark:text-white">{selectedPolicy.coverage}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                        <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-cyan-400 mb-1">Available Balance</p>
                        <p className="text-base font-black text-blue-700 dark:text-cyan-300">₹{selectedPolicy.remainingCoverage.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Deductible</p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">₹{selectedPolicy.deductible.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Room Limit</p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{selectedPolicy.roomRentLimit}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Co-Pay</p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{selectedPolicy.coPayPercent}%</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Members Covered</h3>
                    <div className="space-y-2">
                      {selectedPolicy.members.map((member, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#070c18] border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{member.name}</span>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm">
                            {member.relation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0b1120] shrink-0 space-y-3 sm:space-y-0 sm:flex sm:gap-4">
                  <button
                    onClick={() => setShowPreAuthModal(true)}
                    className="w-full sm:flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                  >
                    <ActivitySquare className="w-4 h-4" /> Start Pre-Authorization
                  </button>
                  <div className="flex gap-3 w-full sm:flex-1">
                    <button
                      onClick={() => setShowClaimsModal(true)}
                      className="flex-1 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors flex items-center justify-center gap-2 active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Claims ({selectedPolicy.claims.length})
                    </button>
                    <button
                      onClick={handleDownloadPolicySummary}
                      className="flex-1 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors flex items-center justify-center gap-2 active:scale-95"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" /> Download Policy
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* CREATE POLICY MODAL (CONTROLLED & WIRED TO MYSQL) */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.form
              onSubmit={handleCreatePolicy}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Create New Policy</h2>
                <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Registered Patient Email *</label>
                  <input
                    type="email"
                    required
                    value={createPatientEmail}
                    onChange={(e) => setCreatePatientEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={createPlanName}
                      onChange={(e) => setCreatePlanName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Policy Number (Optional)</label>
                    <input
                      type="text"
                      value={createPolicyNumber}
                      onChange={(e) => setCreatePolicyNumber(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Coverage (₹) *</label>
                    <input
                      type="number"
                      required
                      min={10000}
                      value={createCoverageAmount}
                      onChange={(e) => setCreateCoverageAmount(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Deductible (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={createDeductible}
                      onChange={(e) => setCreateDeductible(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Co-Pay (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={createCoPay}
                      onChange={(e) => setCreateCoPay(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving Policy...' : 'Save Policy'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* START PRE-AUTH MODAL (CONTROLLED & WIRED TO MYSQL) */}
      <AnimatePresence>
        {showPreAuthModal && selectedPolicy && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPreAuthModal(false)} className="absolute inset-0 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm cursor-pointer" />
            <motion.form
              onSubmit={handleStartPreAuth}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Start Pre-Authorization</h2>
                <button type="button" onClick={() => setShowPreAuthModal(false)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 mb-2">
                  <p className="text-xs font-bold text-blue-800 dark:text-cyan-400">Initiating request for {selectedPolicy.holder} ({selectedPolicy.id})</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hospital / Clinic *</label>
                  {networkHospitals.length > 0 ? (
                    <select
                      value={preAuthHospital}
                      onChange={(e) => setPreAuthHospital(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    >
                      {networkHospitals.map((h: any) => (
                        <option key={h.id} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={preAuthHospital}
                      onChange={(e) => setPreAuthHospital(e.target.value)}
                      placeholder="Enter hospital name"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Proposed Procedure *</label>
                    <input
                      type="text"
                      required
                      value={preAuthProcedure}
                      onChange={(e) => setPreAuthProcedure(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Estimated Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={preAuthAmount}
                      onChange={(e) => setPreAuthAmount(e.target.value)}
                      placeholder="50000"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diagnosis Details *</label>
                  <textarea
                    rows={3}
                    required
                    value={preAuthDiagnosis}
                    onChange={(e) => setPreAuthDiagnosis(e.target.value)}
                    placeholder="Enter preliminary diagnosis..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#070c18] border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Pre-Authorization Request'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW CLAIMS MODAL (REAL CLAIMS FROM DB) */}
      <AnimatePresence>
        {showClaimsModal && selectedPolicy && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowClaimsModal(false)} className="absolute inset-0 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm cursor-pointer" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Claims History</h2>
                  <p className="text-xs text-slate-500 font-bold mt-1">For {selectedPolicy.holder} ({selectedPolicy.id})</p>
                </div>
                <button onClick={() => setShowClaimsModal(false)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {selectedPolicy.claims.length === 0 ? (
                  <p className="py-10 text-center text-sm font-bold text-slate-500">No claims recorded under this policy yet.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Claim ID</th>
                        <th className="px-4 py-3">Hospital & Treatment</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
                      {selectedPolicy.claims.map((c: any) => (
                        <tr key={c.id || c.claimId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.claimId || c.id}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{c.hospital || '—'} • {c.treatment || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {c.admissionDate ? new Date(c.admissionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900 dark:text-white">
                            ₹{Number(c.approvedAmount || c.submittedAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">{c.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
