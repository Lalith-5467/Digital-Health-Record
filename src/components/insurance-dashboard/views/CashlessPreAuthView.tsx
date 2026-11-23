import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, FileText, Download,
  Eye, FileCheck, Stethoscope, Activity, FileSpreadsheet,
  HelpCircle, MessageCircle, XCircle, Loader2
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { insuranceApi } from '../../../services/dhrApis';

export const CashlessPreAuthView: React.FC = () => {
  const { t } = useLanguage();
  const [showToast, setShowToast] = useState<string | null>(null);
  const [preAuthList, setPreAuthList] = useState<any[]>([]);
  const [activePreAuth, setActivePreAuth] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [queryModalOpen, setQueryModalOpen] = useState<boolean>(false);
  const [queryText, setQueryText] = useState<string>('');

  const loadPreAuths = async (preserveId?: string) => {
    setLoading(true);
    try {
      const res = await insuranceApi.getPreAuthorizations();
      if (res?.data && Array.isArray(res.data)) {
        setPreAuthList(res.data);
        const target = preserveId
          ? res.data.find((p: any) => p.id === preserveId) || res.data[0] || null
          : res.data[0] || null;
        setActivePreAuth(target);
      } else {
        setPreAuthList([]);
        setActivePreAuth(null);
      }
    } catch {
      setPreAuthList([]);
      setActivePreAuth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreAuths();
  }, []);

  const displayToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleDecision = async (status: 'Approved' | 'Rejected' | 'Need More Info' | 'Pending', queryNotes?: string) => {
    if (!activePreAuth) {
      displayToast('No active pre-authorization request found in database.');
      return;
    }
    setSubmitting(true);
    try {
      await insuranceApi.updatePreAuthorizationStatus(activePreAuth.id, {
        status,
        ...(queryNotes ? { hospitalQueryNotes: queryNotes } : {}),
      });
      await loadPreAuths(activePreAuth.id);
      displayToast(
        status === 'Approved'
          ? 'Pre-Authorization Approved & saved to MySQL.'
          : status === 'Rejected'
            ? 'Pre-Authorization Rejected & saved to MySQL.'
            : status === 'Need More Info'
              ? 'Information Request saved & dispatched to hospital.'
              : 'Pre-Authorization status reset to Pending.'
      );
    } catch (err: any) {
      displayToast(err?.message || 'Failed to update pre-authorization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;
    await handleDecision('Need More Info', queryText.trim());
    setQueryText('');
    setQueryModalOpen(false);
  };

  const formatDate = (val?: string | null) => {
    if (!val) return 'Not Recorded';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const formatMoney = (val?: number | string | null) => {
    const num = Number(val ?? 0);
    return `₹${isNaN(num) ? '0' : num.toLocaleString('en-IN')}`;
  };

  const parsedDocs: Array<{ name: string; date?: string; url?: string }> = React.useMemo(() => {
    if (!activePreAuth?.documentsJson) return [];
    try {
      const parsed = typeof activePreAuth.documentsJson === 'string'
        ? JSON.parse(activePreAuth.documentsJson)
        : activePreAuth.documentsJson;
      if (Array.isArray(parsed)) {
        return parsed.map((d: any) =>
          typeof d === 'string'
            ? { name: d, date: formatDate(activePreAuth.createdAt) }
            : { name: d.name || d.title || 'Medical Document', date: d.date || formatDate(activePreAuth.createdAt), url: d.url || d.fileUrl }
        );
      }
    } catch {}
    return [];
  }, [activePreAuth]);

  const parsedChecklist: Array<{ label: string; status: string }> = React.useMemo(() => {
    if (activePreAuth?.assessmentChecklistJson) {
      try {
        const parsed = typeof activePreAuth.assessmentChecklistJson === 'string'
          ? JSON.parse(activePreAuth.assessmentChecklistJson)
          : activePreAuth.assessmentChecklistJson;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    if (!activePreAuth) return [];
    const reqAmt = Number(activePreAuth.requestedAmount ?? activePreAuth.estimatedCost ?? 0);
    const eligCov = Number(activePreAuth.eligibleCoverage ?? activePreAuth.policy?.remainingCoverage ?? 0);
    return [
      { label: 'Diagnosis verification', status: activePreAuth.diagnosis ? 'Verified' : 'Pending' },
      { label: 'Policy coverage limit', status: eligCov >= reqAmt ? 'Verified' : 'Review Required' },
      { label: 'Policy active status', status: (activePreAuth.policy?.policyStatus || 'Active') === 'Active' ? 'Verified' : 'Inactive' },
      { label: 'Medical documents check', status: parsedDocs.length > 0 ? 'Verified' : 'Pending' },
    ];
  }, [activePreAuth, parsedDocs.length]);

  const currentStatus = String(activePreAuth?.status || 'Pending');
  const statusLower = currentStatus.toLowerCase();
  const decision: 'pending' | 'approved' | 'rejected' =
    statusLower === 'approved' ? 'approved' : statusLower === 'rejected' ? 'rejected' : 'pending';

  const patientName = activePreAuth?.policy?.patient?.fullName || 'Policy Holder';
  const patientId = activePreAuth?.policy?.patientId || activePreAuth?.policy?.patient?.id || 'Not Recorded';
  const policyNo = activePreAuth?.policy?.insuranceId || activePreAuth?.policy?.policyNumber || 'Not Recorded';
  const policyStatus = activePreAuth?.policy?.policyStatus || 'Active';
  const providerName = activePreAuth?.policy?.provider?.providerName || activePreAuth?.policy?.policyName || 'Health Insurance Desk';

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* TOAST */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto select-auto px-4 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{showToast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('Cashless Pre-Auth')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {t('Review and authorize hospital treatment requests before claim processing.')}
          </p>
        </div>

        {preAuthList.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 pl-2 uppercase tracking-wider">
              {t('Request Queue')} ({preAuthList.length}):
            </span>
            <select
              value={activePreAuth?.id || ''}
              onChange={(e) => {
                const chosen = preAuthList.find((item) => item.id === e.target.value) || null;
                setActivePreAuth(chosen);
              }}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              {preAuthList.map((pa) => (
                <option key={pa.id} value={pa.id}>
                  {pa.preAuthId || pa.id.slice(-8).toUpperCase()} • {pa.policy?.patient?.fullName || 'Patient'} ({pa.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Loading cashless pre-authorization requests...</p>
        </div>
      ) : !activePreAuth ? (
        <div className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 p-14 text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('No Pre-Authorization Requests Yet')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
            {t('When hospitals or policy holders initiate cashless pre-authorization requests, they will appear here for adjudication.')}
          </p>
        </div>
      ) : (
        <>
          {/* 1. PATIENT & POLICY SUMMARY CARD */}
          <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center font-black text-xl text-blue-600 dark:text-cyan-400">
                  {patientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {patientName}
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-extrabold border border-emerald-200 dark:border-emerald-800/50">
                      {t(policyStatus)}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t('Patient ID')}: {String(patientId).slice(-10).toUpperCase()} • {activePreAuth.policy?.policyName || 'Health Policy'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400">{t('Policy ID')}</p>
                <p className="text-sm font-black text-blue-600 dark:text-cyan-400 font-mono">{policyNo}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">{t('Insurance Company')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{providerName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">{t('Hospital')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{activePreAuth.hospitalName || 'Not Recorded'}</p>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">{t('Request Status')}</p>
                  <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{t(currentStatus)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* TWO COLUMN LAYOUT: DETAILS & TRACKER / DOCUMENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT COLUMN (Details & Financials) */}
            <div className="lg:col-span-2 space-y-6">

              {/* 2. PRE-AUTH REQUEST CARD */}
              <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" /> {t('Pre-Authorization Request')}
                  </h3>
                  <span className="text-xs font-mono font-black text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                    {activePreAuth.preAuthId || activePreAuth.id}
                  </span>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Request Type')}</p>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs font-black">
                      <Activity className="w-3.5 h-3.5" /> {activePreAuth.requestType || 'Planned'}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Treatment Type')}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{activePreAuth.treatmentType || 'Inpatient'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Department')}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{activePreAuth.department || 'General Medicine'}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Admission Date')}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatDate(activePreAuth.admissionDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Expected Discharge')}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatDate(activePreAuth.expectedDischargeDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Attending Doctor')}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{activePreAuth.doctorName || 'Not Recorded'}</p>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Diagnosis')}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{activePreAuth.diagnosis || 'Not Recorded'}</p>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t('Proposed Procedure')}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{activePreAuth.procedure || 'Not Recorded'}</p>
                  </div>
                </div>
              </section>

              {/* 3. FINANCIAL SUMMARY */}
              <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2 mb-6">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> {t('Financial Summary')}
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('Estimated Cost')}</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatMoney(activePreAuth.estimatedCost)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-widest mb-1.5">{t('Requested Amount')}</p>
                    <p className="text-lg font-black text-blue-700 dark:text-cyan-300">{formatMoney(activePreAuth.requestedAmount)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">{t('Eligible Coverage')}</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatMoney(activePreAuth.eligibleCoverage)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1.5">{t('Patient Contribution')}</p>
                    <p className="text-lg font-black text-amber-700 dark:text-amber-400">{formatMoney(activePreAuth.patientContribution)}</p>
                  </div>
                </div>
              </section>

              {/* 4. PRE-AUTH STATUS TRACKER */}
              <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 overflow-x-auto">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm mb-6">
                  {t('Pre-Authorization Status')}
                </h3>
                <div className="min-w-[500px]">
                  <div className="flex items-start justify-between relative z-0">
                    <div className="absolute left-6 right-6 top-5 h-1 bg-slate-200 dark:bg-slate-800 z-0 rounded-full" />
                    <div
                      className={`absolute left-6 top-5 h-1 z-0 rounded-full ${
                        decision === 'approved'
                          ? 'right-6 bg-emerald-500'
                          : decision === 'rejected'
                            ? 'right-6 bg-rose-500'
                            : 'right-[35%] bg-emerald-500'
                      }`}
                    />

                    <div className="flex flex-col items-center gap-2 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-white dark:ring-[#0b1120]">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t('Request Submitted')}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-white dark:ring-[#0b1120]">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t('Medical Verification')}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-blue-50 dark:ring-cyan-900/30">
                        {decision === 'pending' ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400">{t('Under Insurance Review')}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 relative z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-[#0b1120] ${decision === 'pending'
                        ? 'bg-white dark:bg-[#0b1120] border-2 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                        : decision === 'approved'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                        }`}>
                        {decision === 'pending' ? <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" /> : decision === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${decision === 'pending' ? 'text-slate-500 dark:text-slate-400' : decision === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                        {decision === 'pending' ? t(currentStatus) : decision === 'approved' ? t('Approved') : t('Rejected')}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* RIGHT COLUMN (Documents & Assessment) */}
            <div className="space-y-6">

              {/* 5. MEDICAL DOCUMENTS */}
              <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col max-h-[450px]">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-500" /> {t('Medical Documents')} ({parsedDocs.length})
                  </h3>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto">
                  {parsedDocs.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400">
                      No medical documents attached to this pre-authorization request.
                    </div>
                  ) : (
                    parsedDocs.map((doc, i) => (
                      <div key={i} className="group p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-blue-200 dark:hover:border-blue-800/50 bg-white dark:bg-slate-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors shrink-0">
                            <Stethoscope className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{doc.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{doc.date || formatDate(activePreAuth.createdAt)}</p>
                          </div>
                        </div>
                        {doc.url && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 cursor-pointer rounded-lg hover:bg-white dark:hover:bg-slate-800"
                              title={t('View Document')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={doc.url}
                              download={doc.name}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 cursor-pointer rounded-lg hover:bg-white dark:hover:bg-slate-800"
                              title={t('Download')}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* 6. MEDICAL & COVERAGE ASSESSMENT */}
              <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm mb-4">
                  {t('Coverage Assessment')}
                </h3>

                <div className="space-y-3">
                  {parsedChecklist.map((item, idx) => {
                    const isVerified = String(item.status).toLowerCase() === 'verified';
                    const isPending = String(item.status).toLowerCase() === 'pending';
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t(item.label)}</span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                            isVerified
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                              : isPending
                                ? 'text-blue-600 dark:text-cyan-400 bg-blue-100 dark:bg-blue-900/30'
                                : 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
                          }`}
                        >
                          {!isVerified && !isPending && <AlertTriangle className="w-3 h-3" />}
                          {t(item.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* 7. HOSPITAL QUERY / ADDITIONAL INFO */}
          {activePreAuth.hospitalQueryNotes && (
            <section className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h3 className="font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider text-sm flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4" /> {t('Hospital Query / Missing Information')}
              </h3>
              <div className="bg-white dark:bg-[#070c18]/50 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {activePreAuth.hospitalQueryNotes}
                </p>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Updated: {formatDate(activePreAuth.actionDate || activePreAuth.updatedAt)}</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                    <Clock className="w-3.5 h-3.5" /> {t(activePreAuth.hospitalQueryStatus || 'Sent to Hospital')}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* 8. BOTTOM ACTION AREA */}
          <section className="sticky bottom-6 z-40 bg-white/90 dark:bg-[#0b1120]/90 backdrop-blur-md rounded-full border border-slate-200 dark:border-slate-800 shadow-2xl p-2 flex flex-col sm:flex-row items-center gap-2 max-w-3xl mx-auto mt-8">
            {decision === 'pending' ? (
              <>
                <button
                  disabled={submitting}
                  onClick={() => handleDecision('Approved')}
                  className="w-full sm:flex-1 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-black text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-5 h-5" /> {t('Approve Pre-Auth')}
                </button>

                <button
                  disabled={submitting}
                  onClick={() => setQueryModalOpen(true)}
                  className="w-full sm:flex-1 py-3 px-6 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <HelpCircle className="w-4 h-4" /> {t('Query Hospital')}
                </button>

                <button
                  disabled={submitting}
                  onClick={() => handleDecision('Rejected')}
                  className="w-full sm:flex-[0.5] py-3 px-6 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-full font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <XCircle className="w-4 h-4" /> {t('Reject Request')}
                </button>
              </>
            ) : (
              <div className={`w-full py-3 px-6 rounded-full font-black text-sm flex items-center justify-center gap-2 ${decision === 'approved'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}>
                {decision === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {decision === 'approved' ? t('Approved') : t('Rejected')}
                <button
                  disabled={submitting}
                  onClick={() => handleDecision('Pending')}
                  className="ml-4 text-[10px] uppercase font-bold underline opacity-70 hover:opacity-100 cursor-pointer"
                >
                  {t('Reset Decision')}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* QUERY HOSPITAL MODAL */}
      <AnimatePresence>
        {queryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-base font-black text-slate-900 dark:text-white">Query Hospital for Clarification</h3>
              <form onSubmit={handleSubmitQuery} className="space-y-4">
                <textarea
                  rows={3}
                  required
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Enter clarification or missing document request for the hospital billing desk..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQueryModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black cursor-pointer disabled:opacity-60"
                  >
                    Send Query to Hospital
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
