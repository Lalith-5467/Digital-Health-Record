import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { patientExtendedApi, vitalApi, medicineApi } from '../../services/dhrApis';

interface HealthInsightCardProps {
  onNavigate: (id: string) => void;
}

const formatRelativeTime = (dateStr?: string | null) => {
  if (!dateStr) return 'Not synced yet';
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Updated ${days}d ago`;
};

export const HealthInsightCard: React.FC<HealthInsightCardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [insightText, setInsightText] = useState<string>(
    'No biometric insights yet. Log your vitals, track medications, or upload a lab report to receive personalized insights.'
  );
  const [subtitleText, setSubtitleText] = useState<string>('Personalized Biometric Analysis');
  const [updatedLabel, setUpdatedLabel] = useState<string>('No data yet');

  useEffect(() => {
    let mounted = true;
    const loadInsight = async () => {
      const [insightsRes, vitalsRes, adherenceRes] = await Promise.all([
        patientExtendedApi.getReportInsights().catch(() => ({ data: [] })),
        vitalApi.getVitals().catch(() => ({ data: [] })),
        medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
      ]);

      if (!mounted) return;

      const insights = Array.isArray(insightsRes?.data) ? insightsRes.data : [];
      const vitals = Array.isArray(vitalsRes?.data) ? vitalsRes.data : [];
      const adherence = adherenceRes?.data;

      if (insights.length > 0) {
        const latest = insights[0];
        const summary =
          latest.summary ||
          latest.aiSummary ||
          latest.recommendation ||
          latest.findings ||
          `Analyzed report: ${latest.reportTitle || latest.title || 'Medical Report'}.`;
        setInsightText(summary);
        setSubtitleText(latest.reportTitle || latest.title || 'Lab Report AI Analysis');
        setUpdatedLabel(formatRelativeTime(latest.updatedAt || latest.createdAt));
        return;
      }

      const parts: string[] = [];
      const latestVital = vitals[0];
      if (latestVital) {
        if (latestVital.heartRate != null) {
          parts.push(`Your latest resting heart rate is ${latestVital.heartRate} BPM`);
        }
        if (latestVital.systolicBp != null && latestVital.diastolicBp != null) {
          parts.push(`blood pressure is ${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg`);
        }
        if (latestVital.oxygenSaturation != null) {
          parts.push(`SpO₂ is ${latestVital.oxygenSaturation}%`);
        }
      }

      if (adherence?.hasData) {
        const rate =
          adherence.summary?.overallAdherence ??
          adherence.summary?.adherenceRate ??
          (Array.isArray(adherence.timeSeries) && adherence.timeSeries.length > 0
            ? Math.round(
                adherence.timeSeries.reduce((s: number, d: any) => s + Number(d.adherencePct || 0), 0) /
                  adherence.timeSeries.length
              )
            : null);
        if (rate != null) {
          parts.push(`your medication adherence is ${Math.round(Number(rate))}%`);
        }
      }

      if (parts.length > 0) {
        setInsightText(`${parts.join(', ')}. Keep logging your vitals regularly for longitudinal trends.`);
        setSubtitleText('Live Vital & Adherence Telemetry');
        setUpdatedLabel(formatRelativeTime(latestVital?.recordedAt || new Date().toISOString()));
      }
    };

    loadInsight();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="p-6 rounded-3xl bg-gradient-to-br from-purple-50 via-indigo-50/70 to-slate-50 dark:from-purple-950/80 dark:via-indigo-950/70 dark:to-slate-900 border border-purple-200/90 dark:border-purple-500/40 text-slate-900 dark:text-white shadow-xl relative overflow-hidden flex flex-col justify-between group"
    >
      {/* GLOW DECORATION */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />

      <div className="relative z-10 space-y-3 font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                {t('insight.title', "Today's AI Health Insight")}
              </h3>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">{subtitleText}</span>
            </div>
          </div>
          <span className="px-3 py-1 text-[10px] font-black uppercase bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full border border-purple-500/30 flex items-center gap-1.5 font-mono shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('insight.smart_tip', 'AI Smart Tip')}</span>
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-100 leading-relaxed max-w-xl font-medium">
          "{insightText}"
        </p>
      </div>

      <div className="pt-4 border-t border-purple-200 dark:border-purple-500/30 flex items-center justify-between relative z-10 font-mono">
        <button
          onClick={() => onNavigate('analytics')}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-[#00a896] dark:text-cyan-300 hover:underline transition-colors cursor-pointer group/btn"
        >
          <span>{t('insight.view_analytics', 'View Health Analytics')}</span>
          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </button>

        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">{updatedLabel}</span>
      </div>
    </motion.div>
  );
};
