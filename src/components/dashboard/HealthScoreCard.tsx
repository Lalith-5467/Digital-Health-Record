import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  Heart, 
  Moon, 
  Zap, 
  RefreshCw, 
  Sparkles,
  Info,
  X,
  CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { vitalApi, patientClinicalApi, medicineApi } from '../../services/dhrApis';

interface ComputedScoreData {
  targetScore: number;
  hasData: boolean;
  heartRate: string;
  spo2: string;
  bp: string;
  sleepAvg: string;
  cardioScore: number | null;
  metabolicScore: number | null;
  sleepScore: number | null;
  adherenceScore: number | null;
  vitalsCount: number;
  trendText: string;
  recommendation: string;
  sparklinePoints: string;
}

export const HealthScoreCard: React.FC = () => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [metrics, setMetrics] = useState<ComputedScoreData>({
    targetScore: 0,
    hasData: false,
    heartRate: 'Not Recorded',
    spo2: 'Not Recorded',
    bp: 'Not Recorded',
    sleepAvg: 'Not Recorded',
    cardioScore: null,
    metabolicScore: null,
    sleepScore: null,
    adherenceScore: null,
    vitalsCount: 0,
    trendText: 'No vitals logged yet',
    recommendation: 'Log your daily vitals, sleep hours, and medication doses to generate personalized health score insights.',
    sparklinePoints: '0,20 240,20',
  });

  const animateCount = (target: number) => {
    if (target <= 0) {
      setScore(0);
      return;
    }
    setScore(0);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 35));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        setScore(target);
        clearInterval(interval);
      } else {
        setScore(current);
      }
    }, 18);
  };

  const fetchMetrics = async () => {
    try {
      const [vitalsRes, wellnessRes, adherenceRes] = await Promise.all([
        vitalApi.getVitals().catch(() => ({ data: [] })),
        patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
        medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
      ]);

      const vitals = Array.isArray(vitalsRes?.data) ? vitalsRes.data : [];
      const wellness = Array.isArray(wellnessRes?.data) ? wellnessRes.data : [];
      const adherenceData = adherenceRes?.data;

      const latestVital = vitals[0];
      const latestWellness = wellness[0];

      const heartRate = latestVital?.heartRate != null ? `${latestVital.heartRate} BPM` : 'Not Recorded';
      const spo2 = latestVital?.oxygenSaturation != null ? `${latestVital.oxygenSaturation}%` : 'Not Recorded';
      const bp =
        latestVital?.systolicBp != null && latestVital?.diastolicBp != null
          ? `${latestVital.systolicBp}/${latestVital.diastolicBp}`
          : 'Not Recorded';

      const sleepLogs = wellness.filter((w: any) => w.sleepHours != null && Number(w.sleepHours) > 0);
      const avgSleep =
        sleepLogs.length > 0
          ? sleepLogs.reduce((acc: number, w: any) => acc + Number(w.sleepHours), 0) / sleepLogs.length
          : latestWellness?.sleepHours != null
            ? Number(latestWellness.sleepHours)
            : null;
      const sleepAvg = avgSleep != null ? `${avgSleep.toFixed(1)} hrs` : 'Not Recorded';

      // Sub-scores
      const cardioParts: number[] = [];
      if (latestVital?.heartRate != null) {
        const hr = Number(latestVital.heartRate);
        cardioParts.push(hr >= 60 && hr <= 100 ? 94 : hr >= 50 && hr <= 110 ? 78 : 62);
      }
      if (latestVital?.systolicBp != null && latestVital?.diastolicBp != null) {
        const sys = Number(latestVital.systolicBp);
        const dia = Number(latestVital.diastolicBp);
        cardioParts.push(sys >= 90 && sys <= 125 && dia >= 60 && dia <= 85 ? 94 : sys <= 140 && dia <= 90 ? 78 : 62);
      }
      if (latestVital?.oxygenSaturation != null) {
        const o2 = Number(latestVital.oxygenSaturation);
        cardioParts.push(o2 >= 95 ? 96 : o2 >= 90 ? 80 : 60);
      }
      const cardioScore =
        cardioParts.length > 0
          ? Math.round(cardioParts.reduce((a, b) => a + b, 0) / cardioParts.length)
          : null;

      let metabolicScore: number | null = null;
      if (latestVital?.bloodSugar != null) {
        const bs = Number(latestVital.bloodSugar);
        metabolicScore = bs >= 70 && bs <= 140 ? 90 : bs <= 180 ? 74 : 58;
      }

      let sleepScore: number | null = null;
      if (avgSleep != null) {
        sleepScore = avgSleep >= 7 && avgSleep <= 9 ? 92 : avgSleep >= 6 ? 78 : 62;
      }

      let adherenceScore: number | null = null;
      if (adherenceData?.hasData) {
        const overall =
          adherenceData.summary?.overallAdherence ??
          adherenceData.summary?.adherenceRate ??
          (Array.isArray(adherenceData.timeSeries) && adherenceData.timeSeries.length > 0
            ? Math.round(
                adherenceData.timeSeries.reduce((s: number, d: any) => s + Number(d.adherencePct || 0), 0) /
                  adherenceData.timeSeries.length
              )
            : null);
        if (overall != null) adherenceScore = Math.round(Number(overall));
      }

      const validSubScores = [cardioScore, metabolicScore, sleepScore, adherenceScore].filter(
        (v): v is number => v !== null
      );
      const computedTarget =
        validSubScores.length > 0
          ? Math.round(validSubScores.reduce((a, b) => a + b, 0) / validSubScores.length)
          : 0;

      // Build sparkline from recent vitals heartRate or adherence timeSeries
      let sparkPoints = '0,20 240,20';
      const recentPts = vitals
        .slice(0, 8)
        .reverse()
        .map((v: any) => Number(v.heartRate || v.oxygenSaturation || 0))
        .filter((n: number) => n > 0);
      if (recentPts.length >= 2) {
        const min = Math.min(...recentPts);
        const max = Math.max(...recentPts);
        const range = max - min || 1;
        sparkPoints = recentPts
          .map((val: number, i: number) => {
            const x = Math.round((i / (recentPts.length - 1)) * 240);
            const y = Math.round(20 - ((val - min) / range) * 16);
            return `${x},${y}`;
          })
          .join(' ');
      }

      const hasData = validSubScores.length > 0;
      const trendText = hasData
        ? `${vitals.length} vital${vitals.length === 1 ? '' : 's'} · ${wellness.length} wellness log${wellness.length === 1 ? '' : 's'}`
        : 'No data yet';
      const recommendation = hasData
        ? computedTarget >= 85
          ? 'Your logged vitals and adherence are in a healthy range. Keep maintaining consistent check-ins.'
          : 'Continue logging vitals, adequate sleep, and timely medications to reach your target score of 90+.'
        : 'Log your vitals, sleep hours, and daily medications to calculate your personalized Health Score.';

      setMetrics({
        targetScore: computedTarget,
        hasData,
        heartRate,
        spo2,
        bp,
        sleepAvg,
        cardioScore,
        metabolicScore,
        sleepScore,
        adherenceScore,
        vitalsCount: vitals.length,
        trendText,
        recommendation,
        sparklinePoints: sparkPoints,
      });

      animateCount(computedTarget);
    } catch {
      setScore(0);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMetrics();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const circumference = 2 * Math.PI * 46;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between group font-sans text-slate-900 dark:text-white dark:bg-slate-900/95 dark:border-slate-800 bg-gradient-to-br from-teal-50 via-teal-100/30 to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 border-[1.5px] border-teal-500/20 dark:border-teal-500/10 shadow-[0_4px_32px_rgba(20,184,166,0.1),_0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_32px_rgba(0,0,0,0.5)]"
      >
        {/* BACKGROUND AMBIENT GLOWS */}
        <div className="absolute -top-16 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" style={{ background: 'radial-gradient(circle,rgba(20,184,166,.18) 0%,transparent 70%)' }} />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full blur-2xl pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(52,211,153,.12) 0%,transparent 70%)' }} />
        {/* Subtle running shoe illustration */}
        <div className="absolute bottom-8 right-6 opacity-[.06] pointer-events-none select-none text-[72px] group-hover:opacity-[.09] transition-opacity duration-500">
          🏃
        </div>

        {/* TOP LABEL & REFRESH ACTION */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {/* Circular gradient icon — matches reference */}
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-slate-900 dark:text-white flex-shrink-0 shadow-md"
              style={{ background: 'linear-gradient(135deg,#2dd4bf,#059669)', boxShadow: '0 4px 14px rgba(20,184,166,.4)' }}
            >
              <Activity className="w-5 h-5" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t('card.your_health_score', 'Your Health Score')}
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowDetailModal(true)}
                  className="text-slate-500 dark:text-slate-400 hover:text-[#00a896] dark:hover:text-cyan-300 transition-colors cursor-pointer"
                  title={t('health_score.score_details', 'Score details')}
                >
                  <Info className="w-3.5 h-3.5" />
                </motion.button>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{metrics.hasData ? (metrics.targetScore >= 80 ? t('card.optimal_vitals', 'Optimal Vitals • Live') : 'Live Health Telemetry') : 'No Data Yet'}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-600 dark:text-slate-300 hover:text-[#00a896] dark:hover:text-cyan-300 transition-all cursor-pointer border border-teal-200/60 dark:border-slate-700"
              title={t('health_score.resync', 'Re-sync Health Vitals')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00a896]' : ''}`} />
            </button>

            <span className="px-3 py-1 text-[11px] font-extrabold rounded-full text-[#00897b] dark:text-cyan-300 border font-mono shadow-xs flex items-center gap-1" style={{ background: 'rgba(20,184,166,.12)', borderColor: 'rgba(20,184,166,.25)' }}>
              <Sparkles className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{t('card.weekly_sync', 'Weekly Sync')}</span>
            </span>
          </div>
        </div>

        {/* MAIN BODY: CIRCULAR GAUGE + VITAL METRICS */}
        <div className="my-5 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center relative z-10">
          
          {/* LEFT: CIRCULAR ANIMATED GAUGE (5 COLS) */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              
              {/* PULSING RADIAL GLOW RING */}
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-2 rounded-full bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-emerald-500/20 blur-md"
              />

              <svg className="w-full h-full transform -rotate-90">
                <defs>
                  <linearGradient id="healthScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00a896" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="46"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="11"
                  fill="transparent"
                />
                
                {/* Animated Progress Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="46"
                  stroke="url(#healthScoreGradient)"
                  strokeWidth="11"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* CENTER TEXT SCORE */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <motion.span 
                  key={score}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none bg-gradient-to-r from-slate-900 via-[#00a896] to-cyan-500 dark:from-white dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent"
                >
                  {score}
                </motion.span>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1 font-mono uppercase tracking-wider">
                  / 100
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: VITAL METRICS SNAPSHOT GRID (7 COLS) — styled per reference */}
          <div className="sm:col-span-7 grid grid-cols-2 gap-2.5 font-sans">
            
            {/* HEART RATE */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 rounded-2xl flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/80 border border-rose-400/20 shadow-[0_2px_8px_rgba(251,113,133,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#fecaca,#f87171)' }}>
                <Heart className="w-3.5 h-3.5 text-slate-900 dark:text-white animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t('card.heart_rate', 'Heart Rate')}</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{metrics.heartRate}</span>
              </div>
            </motion.div>

            {/* SPO2 OXYGEN */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 rounded-2xl flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/80 border border-teal-500/20 shadow-[0_2px_8px_rgba(20,184,166,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#5eead4,#0d9488)' }}>
                <Zap className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t('card.blood_spo2', 'Blood SpO2')}</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{metrics.spo2}</span>
              </div>
            </motion.div>

            {/* BLOOD PRESSURE */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 rounded-2xl flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/80 border border-indigo-500/20 shadow-[0_2px_8px_rgba(99,102,241,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#c7d2fe,#6366f1)' }}>
                <ShieldCheck className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t('card.blood_pressure', 'Blood Pressure')}</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{metrics.bp}</span>
              </div>
            </motion.div>

            {/* SLEEP QUALITY */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 rounded-2xl flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/80 border border-purple-500/20 shadow-[0_2px_8px_rgba(168,85,247,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#e9d5ff,#9333ea)' }}>
                <Moon className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t('card.sleep_avg', 'Sleep Avg.')}</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">{metrics.sleepAvg}</span>
              </div>
            </motion.div>

          </div>
        </div>

        {/* FOOTER: mini sparkline + trend + analysis */}
        <div className="pt-3 border-t relative z-10" style={{ borderColor: 'rgba(20,184,166,.15)' }}>
          {/* Mini sparkline SVG */}
          <svg className="w-full h-6 mb-2" viewBox="0 0 240 24" fill="none" preserveAspectRatio="none">
            <polyline
              points={metrics.sparklinePoints}
              stroke="#14b8a6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <polyline
              points={metrics.sparklinePoints}
              stroke="url(#sparkFill)"
              strokeWidth="0"
              fill="url(#sparkFill)"
              fillOpacity=".15"
            />
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity=".3"/>
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>{metrics.trendText}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{t('score.target_90', 'Target: 90+')}</span>
              <button
                onClick={() => setShowDetailModal(true)}
                className="px-2 py-0.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                style={{ background: 'rgba(20,184,166,.12)', color: '#0d9488' }}
              >
                {t('score.analysis', 'Analysis →')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 font-sans"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-teal-500/15 text-[#00a896] dark:text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('score.modal_title', 'Health Score Breakdown')}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{t('score.modal_desc', 'Calculated from wearable telemetry & medical record sync')}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL SCORE METRICS */}
              <div className="space-y-3 font-mono">
                {[
                  {
                    label: t('score.cardiovascular', 'Cardiovascular Health'),
                    score: metrics.cardioScore !== null ? `${metrics.cardioScore}/100` : 'No data',
                    status: metrics.cardioScore !== null ? (metrics.cardioScore >= 85 ? t('score.status_optimal', 'Optimal') : 'Monitor') : 'Not Recorded',
                    color: 'text-emerald-500',
                  },
                  {
                    label: t('score.metabolic', 'Metabolic & Blood Glucose'),
                    score: metrics.metabolicScore !== null ? `${metrics.metabolicScore}/100` : 'No data',
                    status: metrics.metabolicScore !== null ? (metrics.metabolicScore >= 80 ? t('score.status_good', 'Good') : 'Monitor') : 'Not Recorded',
                    color: 'text-teal-500',
                  },
                  {
                    label: t('score.recovery', 'Sleep & Recovery Cycle'),
                    score: metrics.sleepScore !== null ? `${metrics.sleepScore}/100` : 'No data',
                    status: metrics.sleepScore !== null ? (metrics.sleepScore >= 85 ? t('score.status_optimal', 'Optimal') : 'Fair') : 'Not Recorded',
                    color: 'text-cyan-500',
                  },
                  {
                    label: t('score.adherence', 'Medication Adherence'),
                    score: metrics.adherenceScore !== null ? `${metrics.adherenceScore}/100` : 'No data',
                    status: metrics.adherenceScore !== null ? (metrics.adherenceScore >= 90 ? t('score.status_perfect', 'Optimal') : 'Track') : 'Not Recorded',
                    color: 'text-emerald-400',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-sans font-bold text-slate-900 dark:text-white">
                      <CheckCircle2 className="w-4 h-4 text-[#00a896]" />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-extrabold ${item.color}`}>{item.score}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                <span className="font-extrabold text-[#00a896] dark:text-cyan-300 block">{t('score.doc_rec_title', 'Health Recommendation:')}</span>
                <p className="font-medium">{metrics.recommendation}</p>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full py-3 rounded-2xl bg-[#00a896] hover:bg-[#00897b] text-white font-extrabold text-xs shadow-md cursor-pointer transition-colors"
              >
                {t('score.close_analysis', 'Close Analysis')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
