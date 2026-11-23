import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Phone, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { nurseOpsApi } from '../../../services/dhrApis';

export const NurseAlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await nurseOpsApi.getClinicalAlerts();
      if (res?.data && Array.isArray(res.data)) {
        setAlerts(res.data);
      }
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleUpdateAlert = async (id: string, status: 'DISPATCHED' | 'RESOLVED', patientName: string) => {
    try {
      await nurseOpsApi.updateClinicalAlertStatus(id, status);
      await loadAlerts();
      setToast(`Alert updated to ${status} for ${patientName}.`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to update clinical alert.');
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans select-none">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider mb-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Emergency Triage Monitor
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Clinical Alerts & Emergency SOS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Real-time biometric threshold breaches and patient rapid response dispatches.
          </p>
        </div>

        <a
          href="tel:108"
          className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-500/30 flex items-center gap-2 self-start sm:self-auto cursor-pointer transition-all"
        >
          <Phone className="w-4 h-4" />
          <span>Call Hospital ER (108 / Direct)</span>
        </a>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            Loading live clinical alerts from database...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            No active clinical triage alerts at this time.
          </div>
        ) : (
          alerts.map((alt) => {
            const isCritical = String(alt.severity || '').toUpperCase() === 'CRITICAL';
            const patientName = alt.patient?.fullName || 'Patient';
            return (
              <motion.div
                key={alt.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
                  isCritical
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60'
                    : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-200/60 dark:border-rose-900/40">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white shadow-sm shrink-0 ${
                      isCritical ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isCritical ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                        }`}>
                          {alt.severity} • {alt.status}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">{alt.id.slice(-8)}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                        {alt.title} • {patientName}
                      </h3>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-500">
                    {new Date(alt.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{alt.message}</p>

                <div className="flex items-center justify-end gap-3 pt-1">
                  {alt.status === 'OPEN' && (
                    <button
                      onClick={() => handleUpdateAlert(alt.id, 'DISPATCHED', patientName)}
                      className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs rounded-xl shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Dispatch Rapid Response</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {alt.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleUpdateAlert(alt.id, 'RESOLVED', patientName)}
                      className="px-4 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-sm hover:bg-emerald-500 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
