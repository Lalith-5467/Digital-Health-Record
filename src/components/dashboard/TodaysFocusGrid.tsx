import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pill, Calendar, FileText, Sparkles, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { medicineApi, appointmentApi, recordApi } from '../../services/dhrApis';

interface TodaysFocusGridProps {
  onNavigate: (id: string) => void;
  onToast: (msg: string) => void;
}

export const TodaysFocusGrid: React.FC<TodaysFocusGridProps> = ({ onNavigate, onToast }) => {
  const { t } = useLanguage();
  const [nextDose, setNextDose] = useState<any | null>(null);
  const [medTaken, setMedTaken] = useState(false);
  const [takingMed, setTakingMed] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<any | null>(null);
  const [latestRecord, setLatestRecord] = useState<any | null>(null);

  const loadFocusData = async () => {
    const [medsRes, aptsRes, recsRes] = await Promise.all([
      medicineApi.getActiveMedications().catch(() => ({ data: { medications: [], todayDoses: [] } })),
      appointmentApi.getAppointments().catch(() => ({ data: [] })),
      recordApi.getMedicalRecords().catch(() => ({ data: [] })),
    ]);

    const todayDoses = Array.isArray(medsRes?.data?.todayDoses) ? medsRes.data.todayDoses : [];
    const upcomingDose =
      todayDoses.find((d: any) => d.status === 'Upcoming' || d.status === 'Due Now' || d.status === 'upcoming') ||
      todayDoses[0] ||
      null;
    setNextDose(upcomingDose);
    setMedTaken(upcomingDose ? upcomingDose.status === 'Taken' || upcomingDose.status === 'taken' : false);

    const apts = Array.isArray(aptsRes?.data) ? aptsRes.data : [];
    const upcomingApt =
      apts.find((a: any) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') || null;
    setNextAppointment(upcomingApt);

    const recs = Array.isArray(recsRes?.data) ? recsRes.data : [];
    setLatestRecord(recs[0] || null);
  };

  useEffect(() => {
    loadFocusData();
    const handleRefresh = () => loadFocusData();
    window.addEventListener('health_workflow_updated', handleRefresh);
    return () => window.removeEventListener('health_workflow_updated', handleRefresh);
  }, []);

  const handleTakeMed = async () => {
    if (!nextDose || medTaken || takingMed) return;
    setTakingMed(true);
    try {
      await medicineApi.recordDoseLog({
        doseId: nextDose.id,
        medicineId: nextDose.medicineId || nextDose.id,
        status: 'taken',
      });
      setMedTaken(true);
      window.dispatchEvent(new Event('health_workflow_updated'));
      onToast(`✓ ${nextDose.medicineName} marked as taken!`);
    } catch (err: any) {
      onToast(err?.message || 'Failed to record dose');
    } finally {
      setTakingMed(false);
    }
  };

  return (
    <section className="space-y-3 font-sans h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('card.todays_focus', "Today's Focus")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t('focus.subtitle', 'Your high-priority health tasks & scheduled activities for today.')}
          </p>
        </div>
      </div>

      {/* 2x2 Grid that perfectly fits the half-width dashboard column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">

        {/* CARD 1: MEDICINE */}
        <motion.div
          whileHover={{ y: -3, scale: 1.015 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between group relative overflow-hidden bg-gradient-to-br from-amber-50 via-amber-100/40 to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 border-[1.5px] border-amber-500/20 dark:border-amber-500/10 shadow-[0_4px_16px_rgba(245,158,11,0.08),_0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
        >
          <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(245,158,11,.12) 0%,transparent 70%)' }} />
          <div className="flex items-center justify-between relative z-10">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)', boxShadow: '0 3px 10px rgba(245,158,11,.3)' }}>
              <Pill className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(245,158,11,.12)', color: '#92400e', border: '1px solid rgba(245,158,11,.25)' }}>
              {nextDose?.scheduledTime || 'No Doses'}
            </span>
          </div>

          <div className="my-2.5 space-y-0.5 relative z-10">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug truncate">
              {nextDose ? nextDose.medicineName : 'No Scheduled Doses'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {nextDose ? (nextDose.dosage || 'Scheduled dose') : 'Add active medicines to track today'}
            </p>
          </div>

          {nextDose ? (
            <button
              onClick={handleTakeMed}
              disabled={medTaken || takingMed}
              className="w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10 disabled:opacity-75"
              style={medTaken
                ? { background: 'rgba(16,185,129,.12)', color: '#059669', border: '1px solid rgba(16,185,129,.25)' }
                : { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1c1917', boxShadow: '0 3px 10px rgba(245,158,11,.3)' }}
            >
              {medTaken
                ? <><Check className="w-3.5 h-3.5" /><span>{t('focus.taken_done', 'Taken ✓')}</span></>
                : <span>{takingMed ? 'Recording...' : t('focus.take_dose', 'Take Dose Now')}</span>}
            </button>
          ) : (
            <button
              onClick={() => onNavigate('medicines')}
              className="w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1c1917', boxShadow: '0 3px 10px rgba(245,158,11,.3)' }}
            >
              <span>Manage Medicines</span>
            </button>
          )}
        </motion.div>

        {/* CARD 2: APPOINTMENT */}
        <motion.div
          whileHover={{ y: -3, scale: 1.015 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between group relative overflow-hidden bg-gradient-to-br from-blue-50 via-blue-100/40 to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 border-[1.5px] border-blue-500/20 dark:border-blue-500/10 shadow-[0_4px_16px_rgba(59,130,246,0.07),_0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
        >
          <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(59,130,246,.1) 0%,transparent 70%)' }} />
          <div className="flex items-center justify-between relative z-10">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#93c5fd,#3b82f6)', boxShadow: '0 3px 10px rgba(59,130,246,.3)' }}>
              <Calendar className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(59,130,246,.12)', color: '#1e40af', border: '1px solid rgba(59,130,246,.25)' }}>
              {nextAppointment?.slotTime || 'Unscheduled'}
            </span>
          </div>

          <div className="my-2.5 space-y-0.5 relative z-10">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug truncate">
              {nextAppointment ? (nextAppointment.doctor?.fullName || 'Scheduled Consultation') : 'No Upcoming Visits'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {nextAppointment
                ? `${nextAppointment.doctor?.speciality || 'Consultation'} · ${nextAppointment.type === 'VIDEO' ? 'Video' : 'In-Person'}`
                : 'Book a specialist consultation anytime'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('appointments')}
            className="w-full py-2 px-3 rounded-xl text-white text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer relative z-10"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 3px 10px rgba(59,130,246,.3)' }}
          >
            {nextAppointment ? t('focus.view_appointment', 'View Appointment') : 'Book Appointment'}
          </button>
        </motion.div>

        {/* CARD 3: HEALTH RECORD */}
        <motion.div
          whileHover={{ y: -3, scale: 1.015 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between group relative overflow-hidden bg-gradient-to-br from-green-50 via-green-100/40 to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 border-[1.5px] border-green-500/20 dark:border-green-500/10 shadow-[0_4px_16px_rgba(34,197,94,0.07),_0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
        >
          <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(34,197,94,.1) 0%,transparent 70%)' }} />
          <div className="flex items-center justify-between relative z-10">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#86efac,#16a34a)', boxShadow: '0 3px 10px rgba(22,163,74,.3)' }}>
              <FileText className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(34,197,94,.12)', color: '#166534', border: '1px solid rgba(34,197,94,.25)' }}>
              {latestRecord ? (latestRecord.status || 'Synced') : 'Empty Vault'}
            </span>
          </div>

          <div className="my-2.5 space-y-0.5 relative z-10">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug truncate">
              {latestRecord ? latestRecord.title : 'No Records Uploaded'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {latestRecord
                ? `${latestRecord.hospital || latestRecord.type || 'Medical Record'}`
                : 'Upload or scan lab reports to vault'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('records')}
            className="w-full py-2 px-3 rounded-xl text-white text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer relative z-10"
            style={{ background: 'linear-gradient(135deg,#00a896,#059669)', boxShadow: '0 3px 10px rgba(0,168,150,.3)' }}
          >
            {latestRecord ? t('focus.view_lab', 'View Medical Record') : 'Open Health Vault'}
          </button>
        </motion.div>

        {/* CARD 4: AI HEALTH */}
        <motion.div
          whileHover={{ y: -3, scale: 1.015 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between group relative overflow-hidden"
          style={{
            background: 'linear-gradient(150deg,#2e1065 0%,#3b0764 40%,#1e1b4b 100%)',
            border: '1.5px solid rgba(167,139,250,.25)',
            boxShadow: '0 4px 24px rgba(109,40,217,.2), 0 1px 3px rgba(0,0,0,.1)'
          }}
        >
          {/* Mesh glows */}
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(139,92,246,.25) 0%,transparent 70%)' }} />
          <div className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(6,182,212,.15) 0%,transparent 70%)' }} />

          <div className="flex items-center justify-between relative z-10">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base"
              style={{ background: 'linear-gradient(135deg,rgba(139,92,246,.5),rgba(109,40,217,.7))', border: '1px solid rgba(167,139,250,.3)', boxShadow: '0 3px 10px rgba(109,40,217,.4)' }}>
              🤖
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,rgba(139,92,246,.4),rgba(99,102,241,.4))', border: '1px solid rgba(167,139,250,.3)', color: '#c4b5fd' }}>
              <Sparkles className="w-2.5 h-2.5" />
              <span>{t('focus.ai_powered', 'AI Powered')}</span>
            </span>
          </div>

          <div className="my-2.5 space-y-0.5 relative z-10">
            <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
              {t('focus.ask_ai_title', 'Ask AI Assistant')}
            </h4>
            <p className="text-[11px] text-purple-200 font-medium">
              {t('focus.ask_ai_desc', 'Instant symptoms & lab insights')}
            </p>
          </div>

          <button
            onClick={() => onNavigate('ai-assistant')}
            className="w-full py-2 px-3 rounded-xl text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 3px 12px rgba(124,58,237,.4)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('focus.ask_ai_button', 'Ask AI Companion')}</span>
          </button>
        </motion.div>

      </div>
    </section>
  );
};
