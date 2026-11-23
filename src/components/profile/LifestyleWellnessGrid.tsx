import React, { useState, useEffect } from 'react';
import { Moon, Footprints, Flame, Droplets, Utensils, Smile } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { patientClinicalApi, patientExtendedApi } from '../../services/dhrApis';

export const LifestyleWellnessGrid: React.FC = () => {
  const { t } = useLanguage();
  const [latestLog, setLatestLog] = useState<any | null>(null);
  const [dietAssessment, setDietAssessment] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
      patientExtendedApi.getDietAssessment().catch(() => ({ data: null })),
    ]).then(([logsRes, dietRes]) => {
      if (!mounted) return;
      const logs = Array.isArray(logsRes?.data) ? logsRes.data : [];
      setLatestLog(logs[0] || null);
      setDietAssessment(dietRes?.data || null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const sleepHours = latestLog?.sleepHours != null ? Number(latestLog.sleepHours) : null;
  const sleepFormatted =
    sleepHours != null
      ? `${Math.floor(sleepHours)}h ${Math.round((sleepHours - Math.floor(sleepHours)) * 60)}m`
      : 'Not Recorded';
  const sleepProgress = sleepHours != null ? Math.min(100, Math.round((sleepHours / 8) * 100)) : 0;

  const stepsVal = latestLog?.steps != null ? Number(latestLog.steps) : null;
  const stepsFormatted = stepsVal != null ? stepsVal.toLocaleString() : 'Not Recorded';
  const stepsProgress = stepsVal != null ? Math.min(100, Math.round((stepsVal / 10000) * 100)) : 0;

  const exerciseMins = latestLog?.exerciseMinutes != null ? Number(latestLog.exerciseMinutes) : null;
  const exerciseFormatted = exerciseMins != null ? `${exerciseMins} min` : 'Not Recorded';
  const exerciseProgress = exerciseMins != null ? Math.min(100, Math.round((exerciseMins / 60) * 100)) : 0;

  const waterLiters =
    latestLog?.waterLiters != null
      ? Number(latestLog.waterLiters)
      : latestLog?.hydrationLiters != null
        ? Number(latestLog.hydrationLiters)
        : null;
  const waterFormatted = waterLiters != null ? `${waterLiters.toFixed(1)} L` : 'Not Recorded';
  const waterProgress = waterLiters != null ? Math.min(100, Math.round((waterLiters / 3) * 100)) : 0;

  const nutritionLabel =
    latestLog?.dietQuality ||
    dietAssessment?.dietPreference ||
    dietAssessment?.goal ||
    'Not Recorded';
  const nutritionProgress = nutritionLabel !== 'Not Recorded' ? 100 : 0;

  const stressVal = latestLog?.stressLevel || 'Not Recorded';
  const stressProgress =
    stressVal === 'Low'
      ? 25
      : stressVal === 'Moderate'
        ? 55
        : stressVal === 'High'
          ? 85
          : stressVal !== 'Not Recorded'
            ? 50
            : 0;

  const items = [
    { label: t('profile.sleep_quality', 'Sleep Duration'), value: sleepFormatted, progress: sleepProgress, icon: Moon, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', bar: 'bg-indigo-500' },
    { label: t('snapshot.daily_steps', 'Daily Steps'), value: stepsFormatted, progress: stepsProgress, icon: Footprints, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' },
    { label: t('profile.activity_level', 'Exercise'), value: exerciseFormatted, progress: exerciseProgress, icon: Flame, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' },
    { label: t('profile.water_intake', 'Hydration'), value: waterFormatted, progress: waterProgress, icon: Droplets, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', bar: 'bg-cyan-500' },
    { label: t('profile.diet_type', 'Nutrition'), value: nutritionLabel, progress: nutritionProgress, icon: Utensils, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', bar: 'bg-teal-500' },
    { label: t('profile.lifestyle', 'Stress Level'), value: stressVal, progress: stressProgress, icon: Smile, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', bar: 'bg-purple-500' }
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
        {t('profile.lifestyle', 'Lifestyle & Wellness')}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((it, idx) => {
          const Icon = it.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl border ${it.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{it.progress}%</span>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                  {it.label}
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white tracking-tight block truncate">
                  {it.value}
                </span>
              </div>

              {/* SMALL PROGRESS BAR */}
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div style={{ width: `${it.progress}%` }} className={`h-full rounded-full ${it.bar}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
