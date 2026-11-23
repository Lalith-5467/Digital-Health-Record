import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { vitalApi, patientClinicalApi, medicineApi } from '../../services/dhrApis';

interface ProfileHealthScoreCardProps {
  onNavigate: (id: string) => void;
}

export const ProfileHealthScoreCard: React.FC<ProfileHealthScoreCardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string>('No Data');
  const [subtitle, setSubtitle] = useState<string>('Log vitals to calculate');

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    Promise.all([
      vitalApi.getVitals().catch(() => ({ data: [] })),
      patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
      medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
    ]).then(([vitalsRes, wellnessRes, adherenceRes]) => {
      if (!mounted) return;
      const vitals = Array.isArray(vitalsRes?.data) ? vitalsRes.data : [];
      const wellness = Array.isArray(wellnessRes?.data) ? wellnessRes.data : [];
      const latestVital = vitals[0];
      const latestWellness = wellness[0];

      const parts: number[] = [];
      if (latestVital?.heartRate != null) {
        const hr = Number(latestVital.heartRate);
        parts.push(hr >= 60 && hr <= 100 ? 94 : hr >= 50 && hr <= 110 ? 78 : 62);
      }
      if (latestVital?.systolicBp != null && latestVital?.diastolicBp != null) {
        const sys = Number(latestVital.systolicBp);
        const dia = Number(latestVital.diastolicBp);
        parts.push(sys >= 90 && sys <= 125 && dia >= 60 && dia <= 85 ? 94 : sys <= 140 ? 78 : 62);
      }
      if (latestVital?.oxygenSaturation != null) {
        const o2 = Number(latestVital.oxygenSaturation);
        parts.push(o2 >= 95 ? 96 : o2 >= 90 ? 80 : 60);
      }
      if (latestWellness?.sleepHours != null) {
        const sl = Number(latestWellness.sleepHours);
        parts.push(sl >= 7 && sl <= 9 ? 92 : sl >= 6 ? 78 : 62);
      }
      if (adherenceRes?.data?.hasData) {
        const rate = adherenceRes.data.summary?.overallAdherence ?? adherenceRes.data.summary?.adherenceRate ?? null;
        if (rate != null) parts.push(Math.round(Number(rate)));
      }

      const targetScore = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

      if (targetScore === 0) {
        setScore(0);
        setStatusLabel('No Data');
        setSubtitle('Log vitals to calculate');
        return;
      }

      setStatusLabel(
        targetScore >= 85 ? t('profile.excellent', 'Excellent') : targetScore >= 70 ? 'Good' : 'Moderate'
      );
      setSubtitle(`${vitals.length} vital${vitals.length === 1 ? '' : 's'} synced`);

      let current = 0;
      const step = Math.max(1, Math.ceil(targetScore / 28));
      intervalId = setInterval(() => {
        current += step;
        if (current >= targetScore) {
          setScore(targetScore);
          if (intervalId) clearInterval(intervalId);
        } else {
          setScore(current);
        }
      }, 22);
    });

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const radius = 31;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div
      onClick={() => onNavigate('analytics')}
      className="p-4 sm:p-5 h-full rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:border-teal-500/30 transition-all group overflow-hidden"
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-teal-500/10 text-[#00a896] dark:text-cyan-400 border border-teal-500/20 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{t('profile.health_score', 'Health Score')}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{score}</span>
          <span className="text-xs font-extrabold text-emerald-500">{statusLabel}</span>
        </div>
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 truncate">
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>{subtitle}</span>
        </p>
      </div>

      {/* COMPACT CIRCULAR RING */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
        <svg
          viewBox="0 0 80 80"
          className="w-full h-full transform -rotate-90 overflow-visible"
        >
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-emerald-500 transition-all duration-500 ease-out"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-sm sm:text-base font-black text-slate-900 dark:text-white">{score}</span>
      </div>
    </div>
  );
};
