import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { vitalApi, patientClinicalApi, medicineApi } from '../../services/dhrApis';

interface ChartBucket {
  label: string;
  steps: number;
  sleep: number;
  heart: number;
}

export const HealthProgressChart: React.FC = () => {
  const { t } = useLanguage();
  const [timeframe, setTimeframe] = useState<'7d' | '30d'>('7d');
  const [activeMetric, setActiveMetric] = useState<'steps' | 'sleep' | 'heart'>('steps');
  const [vitals, setVitals] = useState<any[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<any[]>([]);
  const [adherenceRate, setAdherenceRate] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadSeries = async () => {
      const [vitalsRes, wellnessRes, adhRes] = await Promise.all([
        vitalApi.getVitals().catch(() => ({ data: [] })),
        patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
        medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
      ]);
      if (!mounted) return;
      setVitals(Array.isArray(vitalsRes?.data) ? vitalsRes.data : []);
      setWellnessLogs(Array.isArray(wellnessRes?.data) ? wellnessRes.data : []);
      if (adhRes?.data?.hasData) {
        const rate = adhRes.data.summary?.overallAdherence ?? adhRes.data.summary?.adherenceRate ?? null;
        if (rate != null) setAdherenceRate(Math.round(Number(rate)));
      }
    };
    loadSeries();
    return () => {
      mounted = false;
    };
  }, []);

  const chartData: ChartBucket[] = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (timeframe === '7d') {
      const days: ChartBucket[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

        const dayWellness = wellnessLogs.filter((w) => {
          const ts = new Date(w.logDate || w.recordedAt || w.createdAt).getTime();
          return !isNaN(ts) && ts >= dayStart && ts <= dayEnd;
        });
        const dayVitals = vitals.filter((v) => {
          const ts = new Date(v.recordedAt || v.createdAt).getTime();
          return !isNaN(ts) && ts >= dayStart && ts <= dayEnd;
        });

        const steps = dayWellness.reduce((sum, w) => sum + Number(w.steps || 0), 0);
        const sleepVals = dayWellness.map((w) => Number(w.sleepHours || 0)).filter((n) => n > 0);
        const sleep = sleepVals.length > 0 ? Number((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)) : 0;
        const heartVals = dayVitals.map((v) => Number(v.heartRate || 0)).filter((n) => n > 0);
        const heart = heartVals.length > 0 ? Math.round(heartVals.reduce((a, b) => a + b, 0) / heartVals.length) : 0;

        days.push({
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          steps,
          sleep,
          heart,
        });
      }
      return days;
    }

    // 30D view: 6 five-day buckets ending today
    const buckets: ChartBucket[] = [];
    for (let b = 5; b >= 0; b--) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - b * 5);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 4);
      startDate.setHours(0, 0, 0, 0);

      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      const bucketWellness = wellnessLogs.filter((w) => {
        const ts = new Date(w.logDate || w.recordedAt || w.createdAt).getTime();
        return !isNaN(ts) && ts >= startMs && ts <= endMs;
      });
      const bucketVitals = vitals.filter((v) => {
        const ts = new Date(v.recordedAt || v.createdAt).getTime();
        return !isNaN(ts) && ts >= startMs && ts <= endMs;
      });

      const stepVals = bucketWellness.map((w) => Number(w.steps || 0)).filter((n) => n > 0);
      const steps = stepVals.length > 0 ? Math.round(stepVals.reduce((a, b) => a + b, 0) / stepVals.length) : 0;
      const sleepVals = bucketWellness.map((w) => Number(w.sleepHours || 0)).filter((n) => n > 0);
      const sleep = sleepVals.length > 0 ? Number((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)) : 0;
      const heartVals = bucketVitals.map((v) => Number(v.heartRate || 0)).filter((n) => n > 0);
      const heart = heartVals.length > 0 ? Math.round(heartVals.reduce((a, b) => a + b, 0) / heartVals.length) : 0;

      buckets.push({
        label: endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        steps,
        sleep,
        heart,
      });
    }
    return buckets;
  }, [timeframe, vitals, wellnessLogs]);

  const nonZeroValues = chartData.map((d) => d[activeMetric]).filter((v) => v > 0);
  const avgVal =
    nonZeroValues.length > 0
      ? activeMetric === 'sleep'
        ? (nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length).toFixed(1)
        : Math.round(nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length).toLocaleString()
      : null;

  const maxVal = useMemo(() => {
    const dataMax = Math.max(0, ...chartData.map((d) => d[activeMetric]));
    if (activeMetric === 'steps') return Math.max(10000, dataMax);
    if (activeMetric === 'sleep') return Math.max(10, dataMax);
    return Math.max(120, dataMax);
  }, [chartData, activeMetric]);

  const subtitleText = avgVal
    ? activeMetric === 'steps'
      ? `Avg ${avgVal} steps (${timeframe.toUpperCase()})`
      : activeMetric === 'sleep'
        ? `Avg ${avgVal} hrs sleep (${timeframe.toUpperCase()})`
        : `Avg ${avgVal} BPM (${timeframe.toUpperCase()})`
    : adherenceRate !== null
      ? `Medication adherence: ${adherenceRate}% · Log ${activeMetric} data`
      : `No ${activeMetric} logs in last ${timeframe === '7d' ? '7' : '30'} days`;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4 font-sans"
    >
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('chart.title', 'Health Progress Analytics')}
            </h3>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{subtitleText}</span>
            </span>
          </div>
        </div>

        {/* METRIC TOGGLES & TIMEFRAME */}
        <div className="flex items-center gap-2 font-mono">
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveMetric('steps')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${activeMetric === 'steps' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {t('chart.steps', 'Steps')}
            </button>
            <button
              onClick={() => setActiveMetric('sleep')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${activeMetric === 'sleep' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {t('chart.sleep', 'Sleep')}
            </button>
            <button
              onClick={() => setActiveMetric('heart')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${activeMetric === 'heart' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {t('chart.heart', 'Heart')}
            </button>
          </div>

          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center text-xs font-bold">
            <button
              onClick={() => setTimeframe('7d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${timeframe === '7d' ? 'bg-[#00a896] text-white shadow-sm font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeframe('30d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${timeframe === '30d' ? 'bg-[#00a896] text-white shadow-sm font-extrabold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              30D
            </button>
          </div>
        </div>
      </div>

      {/* BAR CHART GRAPH */}
      <div className="h-48 pt-6 flex items-end justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 px-2 font-mono">
        {chartData.map((d, idx) => {
          const val = d[activeMetric];
          const heightPercent = val > 0 ? Math.max(6, Math.round((val / maxVal) * 100)) : 0;
          return (
            <div key={`${timeframe}-${idx}`} className="flex-1 flex flex-col items-center gap-2 group relative">
              {/* HOVER TOOLTIP */}
              <div className="absolute -top-9 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-extrabold shadow-2xl border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                {d.label}: {val > 0 ? `${val} ${activeMetric === 'steps' ? t('chart.steps', 'steps') : activeMetric === 'sleep' ? 'hrs' : 'BPM'}` : 'No data'}
              </div>

              {/* BAR GRAPH STICK */}
              <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-950 rounded-t-xl h-36 flex items-end overflow-hidden border border-slate-200 dark:border-slate-800">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercent}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.05 }}
                  className="w-full bg-gradient-to-t from-indigo-600 via-purple-600 to-[#00a896] rounded-t-xl transition-all duration-300 group-hover:brightness-125 shadow-md"
                />
              </div>

              {/* DAY LABEL */}
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-full">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
