import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Moon, Heart, Pill, FileText, BookOpen } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { vitalApi, patientClinicalApi, medicineApi, recordApi } from '../../services/dhrApis';

interface AIAssistantDashboardCardProps {
  onNavigate: (id: string) => void;
}

export const AIAssistantDashboardCard: React.FC<AIAssistantDashboardCardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [telemetry, setTelemetry] = useState({
    sleepValue: 'Not Recorded',
    heartRateValue: 'Not Recorded',
    activeMedsValue: '0 Active',
    recordsValue: '0 Synced',
  });

  useEffect(() => {
    let mounted = true;
    const loadTelemetry = async () => {
      const [vitalsRes, wellnessRes, medsRes, recsRes] = await Promise.all([
        vitalApi.getVitals().catch(() => ({ data: [] })),
        patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
        medicineApi.getActiveMedications().catch(() => ({ data: { medications: [], todayDoses: [] } })),
        recordApi.getMedicalRecords().catch(() => ({ data: [] })),
      ]);

      if (!mounted) return;

      const vitals = Array.isArray(vitalsRes?.data) ? vitalsRes.data : [];
      const wellness = Array.isArray(wellnessRes?.data) ? wellnessRes.data : [];
      const meds = Array.isArray(medsRes?.data?.medications) ? medsRes.data.medications : [];
      const recs = Array.isArray(recsRes?.data) ? recsRes.data : [];

      const latestVital = vitals[0];
      const latestWellness = wellness[0];
      const activeMedsCount = meds.filter((m: any) => !m.status || m.status === 'Active' || m.status === 'ACTIVE').length;

      setTelemetry({
        sleepValue: latestWellness?.sleepHours != null ? `${Number(latestWellness.sleepHours).toFixed(1)} hrs` : 'Not Recorded',
        heartRateValue: latestVital?.heartRate != null ? `${latestVital.heartRate} BPM` : 'Not Recorded',
        activeMedsValue: `${activeMedsCount} Active`,
        recordsValue: `${recs.length} Record${recs.length === 1 ? '' : 's'}`,
      });
    };

    loadTelemetry();
    return () => {
      mounted = false;
    };
  }, []);

  const liveTelemetry = [
    { icon: Moon, label: t('card.sleep_avg', 'Sleep Log'), value: telemetry.sleepValue, color: '#818cf8', bg: 'rgba(129,140,248,.12)', border: 'rgba(129,140,248,.25)' },
    { icon: Heart, label: t('card.heart_rate', 'Heart Rate'), value: telemetry.heartRateValue, color: '#34d399', bg: 'rgba(52,211,153,.12)', border: 'rgba(52,211,153,.25)' },
    { icon: Pill, label: t('card.active_medicines', 'Medications'), value: telemetry.activeMedsValue, color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.25)' },
    { icon: FileText, label: t('nav.records', 'Health Vault'), value: telemetry.recordsValue, color: '#c084fc', bg: 'rgba(192,132,252,.12)', border: 'rgba(192,132,252,.25)' },
  ];

  const promptActions = [
    { icon: FileText, label: t('ai_card.prompt_appt', 'Prepare for Appointment'), color: '#7dd3fc', bg: 'rgba(56,189,248,.08)', border: 'rgba(56,189,248,.2)' },
    { icon: BookOpen, label: t('ai_card.prompt_terms', 'Explain Medical Term'), color: '#d8b4fe', bg: 'rgba(192,132,252,.08)', border: 'rgba(192,132,252,.2)' },
    { icon: Pill, label: t('ai_card.prompt_side_effects', 'Medicine & Side Effects'), color: '#6ee7b7', bg: 'rgba(52,211,153,.08)', border: 'rgba(52,211,153,.2)' },
  ];

  return (
    <div
      className="p-5 sm:p-6 rounded-3xl flex flex-col justify-between font-sans space-y-4 relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(145deg,#131138 0%,#241f5a 35%,#1c1746 70%,#0e1526 100%)',
        border: '1.5px solid rgba(167,139,250,.28)',
        boxShadow: '0 12px 40px rgba(109,40,217,.22), 0 1px 3px rgba(0,0,0,.2)'
      }}
    >
      {/* Static Ambient Lighting & Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
        <div
          className="absolute -top-12 -right-12 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(167,139,250,.25) 0%,transparent 65%)' }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(6,182,212,.18) 0%,transparent 65%)' }}
        />
        <div className="absolute inset-0 opacity-[.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg,rgba(167,139,250,.35),rgba(124,58,237,.55))',
              border: '1px solid rgba(196,181,253,.35)',
              boxShadow: '0 4px 14px rgba(124,58,237,.4)'
            }}
          >
            🤖
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{t('nav.assistant', 'AI Health Assistant')}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </h3>
            <p className="text-xs text-purple-100 font-medium">{t('ai_card.greeting', '"How can I help your health today?"')}</p>
          </div>
        </div>

        {/* Static AI Smart Tip badge */}
        <span
          className="px-3 py-1 text-[10px] font-black uppercase rounded-full flex items-center gap-1.5 shrink-0 shadow-sm cursor-default"
          style={{
            background: 'linear-gradient(135deg,rgba(167,139,250,.3),rgba(99,102,241,.3))',
            border: '1px solid rgba(196,181,253,.35)',
            color: '#e0e7ff'
          }}
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{t('ai_card.badge', 'AI SMART TIP')}</span>
        </span>
      </div>

      {/* Description text */}
      <p className="text-xs text-slate-100 leading-relaxed font-normal sm:font-medium relative z-10">
        {t('ai_card.description', 'Ask symptoms, clarify medical reports in everyday language, analyze drug interactions, or generate customized checklists for your next doctor visit.')}
      </p>

      {/* ── LIVE TELEMETRY CHIPS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative z-10">
        {liveTelemetry.map(({ icon: ChipIcon, label, value, color, bg, border }) => (
          <div
            key={label}
            className="p-2 rounded-xl flex items-center gap-2"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
              <ChipIcon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-200 font-semibold block truncate">{label}</span>
              <span className="text-[11px] font-extrabold block truncate" style={{ color }}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── INTERACTIVE PROMPT BUTTONS ── */}
      <div className="flex flex-wrap items-center gap-2.5 relative z-10">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200 mr-1 font-mono">
          {t('ai_card.quick_ask', 'Quick Ask:')}
        </span>
        {promptActions.map(({ icon: ActionIcon, label, color, bg, border }) => (
          <button
            key={label}
            onClick={() => onNavigate('ai-assistant')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-85 flex items-center gap-1.5 cursor-pointer shadow-xs"
            style={{ background: bg, border: `1px solid ${border}`, color }}
          >
            <ActionIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── FOOTER ACTIONS ── */}
      <div
        className="pt-3.5 flex items-center justify-between relative z-10 flex-wrap gap-2"
        style={{ borderTop: '1px solid rgba(167,139,250,.2)' }}
      >
        <button
          onClick={() => onNavigate('ai-assistant')}
          className="inline-flex items-center gap-2 font-extrabold text-xs sm:text-sm transition-opacity hover:opacity-80 cursor-pointer"
          style={{ color: '#38bdf8' }}
        >
          <span>{t('ai_card.open_assistant', 'Open AI Health Assistant')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onNavigate('analytics')}
          className="inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80 cursor-pointer hover:underline"
          style={{ color: '#d8b4fe' }}
        >
          <span>{t('ai_card.view_analytics', 'View Health Analytics →')}</span>
        </button>
      </div>
    </div>
  );
};
