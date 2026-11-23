import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../ui/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import {
  BarChart3,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Scale,
  Pill,
  Calendar as CalendarIcon,
  FileText,
  Video,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowUpRight,
  Target,
  Download
} from 'lucide-react';
import type { HealthGoal, ActivityItem } from './analyticsData';
import { CreateGoalModal } from './CreateGoalModal';
import { ReportPreviewModal } from './ReportPreviewModal';
import { AnalyticsFilterDrawer } from './AnalyticsFilterDrawer';
import type { AnalyticsFilterState } from './AnalyticsFilterDrawer';
import {
  vitalApi,
  medicineApi,
  patientClinicalApi,
  appointmentApi,
  recordApi,
  profileApi,
} from '../../services/dhrApis';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  abhaId: string;
  bloodGroup: string;
  age: number;
}

interface AnalyticsViewProps {
  user?: UserProfile;
  onNavigate: (page: string) => void;
}

const METRIC_META: Record<string, { color: string; unit: string; minY: number; maxY: number }> = {
  'Heart Rate': { color: '#ff4d6d', unit: 'BPM', minY: 40, maxY: 120 },
  'Blood Pressure': { color: '#818cf8', unit: 'mmHg', minY: 80, maxY: 160 },
  'Temperature': { color: '#f59e0b', unit: '°F', minY: 95, maxY: 103 },
  'SpO2': { color: '#3b82f6', unit: '%', minY: 85, maxY: 100 },
  'Weight': { color: '#10b981', unit: 'kg', minY: 30, maxY: 130 },
};

const generateSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M0,${points[0].y} L100,${points[0].y}`;
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const mx = (p1.x + p2.x) / 2;
    path += ` C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
  }
  return path;
};

const extractVitalNumeric = (v: any, metric: string): number | null => {
  if (!v) return null;
  if (metric === 'Heart Rate' && v.heartRate != null) return Number(v.heartRate);
  if (metric === 'Blood Pressure' && v.systolicBp != null) return Number(v.systolicBp);
  if (metric === 'Temperature' && v.temperature != null) return Number(v.temperature);
  if (metric === 'SpO2' && v.oxygenSaturation != null) return Number(v.oxygenSaturation);
  if (metric === 'Weight' && v.weightKg != null) return Number(v.weightKg);
  return null;
};

const formatVitalDisplay = (v: any, metric: string): string => {
  if (!v) return 'Not Recorded';
  if (metric === 'Heart Rate') return v.heartRate != null ? `${v.heartRate} BPM` : 'Not Recorded';
  if (metric === 'Blood Pressure') return v.systolicBp != null && v.diastolicBp != null ? `${v.systolicBp}/${v.diastolicBp} mmHg` : 'Not Recorded';
  if (metric === 'Temperature') return v.temperature != null ? `${v.temperature} °F` : 'Not Recorded';
  if (metric === 'SpO2') return v.oxygenSaturation != null ? `${v.oxygenSaturation}%` : 'Not Recorded';
  if (metric === 'Weight') return v.weightKg != null ? `${v.weightKg} kg` : 'Not Recorded';
  return 'Not Recorded';
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  user,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // GLOBAL DATE RANGE
  const [globalDateRange, setGlobalDateRange] = useState('30 Days');

  // VITALS CHART METRIC SELECTOR
  const [selectedVitalMetric, setSelectedVitalMetric] = useState<'Heart Rate' | 'Blood Pressure' | 'Temperature' | 'SpO2' | 'Weight'>('Heart Rate');
  const [vitalsTimeframe, setVitalsTimeframe] = useState<'7D' | '30D' | '3M' | '1Y'>('7D');

  // LIVE MYSQL DATA STATES
  const [vitals, setVitals] = useState<any[]>([]);
  const [adherenceData, setAdherenceData] = useState<{ summary: any; timeSeries: any[]; hasData: boolean }>({
    summary: null,
    timeSeries: [],
    hasData: false,
  });
  const [doseHistory, setDoseHistory] = useState<any[]>([]);
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [patientProfile, setPatientProfile] = useState<any>(null);

  // CALENDAR DATE FILTER (Current Month)
  const now = new Date();
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  );

  // MODALS & DRAWERS
  const [createGoalModalOpen, setCreateGoalModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    activityType: 'All',
    status: 'All',
    dateRange: '30 Days',
  });

  const loadAllAnalytics = async () => {
    const [
      vitalsRes,
      adhRes,
      doseRes,
      goalsRes,
      wellnessRes,
      aptsRes,
      recsRes,
      profRes,
    ] = await Promise.all([
      vitalApi.getVitals().catch(() => ({ data: [] })),
      medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
      medicineApi.getDoseHistory('30d').catch(() => ({ data: [] })),
      patientClinicalApi.getGoals().catch(() => ({ data: [] })),
      patientClinicalApi.getWellnessLogs().catch(() => ({ data: [] })),
      appointmentApi.getAppointments().catch(() => ({ data: [] })),
      recordApi.getMedicalRecords().catch(() => ({ data: [] })),
      profileApi.getPatientProfile().catch(() => ({ data: null })),
    ]);

    setVitals(Array.isArray(vitalsRes?.data) ? vitalsRes.data : []);
    if (adhRes?.data) {
      setAdherenceData({
        summary: adhRes.data.summary || null,
        timeSeries: Array.isArray(adhRes.data.timeSeries) ? adhRes.data.timeSeries : [],
        hasData: Boolean(adhRes.data.hasData),
      });
    }
    setDoseHistory(Array.isArray(doseRes?.data) ? doseRes.data : []);
    setWellnessLogs(Array.isArray(wellnessRes?.data) ? wellnessRes.data : []);
    setAppointments(Array.isArray(aptsRes?.data) ? aptsRes.data : []);
    setRecords(Array.isArray(recsRes?.data) ? recsRes.data : []);
    setPatientProfile(profRes?.data || null);

    if (goalsRes?.data && Array.isArray(goalsRes.data)) {
      setGoals(
        goalsRes.data.map((g: any) => {
          const target = Number(g.targetValue ?? 100);
          const current = Number(g.currentValue ?? 0);
          return {
            id: g.id,
            title: g.title,
            category: (g.category || 'Activity') as any,
            current,
            target,
            unit: g.unit || 'pts',
            startDate: g.startDate ? new Date(g.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            endDate: g.endDate ? new Date(g.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            progress: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
            isPaused: Boolean(g.isPaused),
          };
        })
      );
    } else {
      setGoals([]);
    }
  };

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveGoal = async (newGoal: Partial<HealthGoal>) => {
    try {
      await patientClinicalApi.createGoal({
        title: newGoal.title || 'Health Target',
        category: newGoal.category || 'Activity',
        currentValue: Number(newGoal.current ?? 0),
        targetValue: Number(newGoal.target ?? 100),
        unit: newGoal.unit || 'pts',
      });
      await loadAllAnalytics();
      showToast(`✓ Goal "${newGoal.title || 'Health Target'}" saved to database`);
    } catch {
      showToast('Failed to save health goal');
    }
  };

  // REAL COMPUTED METRICS
  const latestVital = vitals[0] || null;
  const adherenceRate = useMemo(() => {
    if (adherenceData.hasData) {
      const rate = adherenceData.summary?.overallAdherence ?? adherenceData.summary?.adherenceRate;
      if (rate != null) return Math.round(Number(rate));
      if (adherenceData.timeSeries.length > 0) {
        return Math.round(
          adherenceData.timeSeries.reduce((s, d) => s + Number(d.adherencePct || 0), 0) /
            adherenceData.timeSeries.length
        );
      }
    }
    if (doseHistory.length > 0) {
      const taken = doseHistory.filter((d) => String(d.status).toLowerCase() === 'taken').length;
      return Math.round((taken / doseHistory.length) * 100);
    }
    return 0;
  }, [adherenceData, doseHistory]);

  const weeklyAdherenceBars = useMemo(() => {
    if (adherenceData.timeSeries.length > 0) {
      return adherenceData.timeSeries.slice(-7).map((d: any) => ({
        day: (d.label || d.date || '').slice(0, 3),
        percentage: Math.round(Number(d.adherencePct || 0)),
      }));
    }
    const days: { day: string; percentage: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const dayKey = dt.toDateString();
      const dayLogs = doseHistory.filter((l) => new Date(l.logDate || l.createdAt).toDateString() === dayKey);
      const pct =
        dayLogs.length > 0
          ? Math.round((dayLogs.filter((l) => String(l.status).toLowerCase() === 'taken').length / dayLogs.length) * 100)
          : 0;
      days.push({
        day: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        percentage: pct,
      });
    }
    return days;
  }, [adherenceData, doseHistory]);

  const todayAdherence = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayLogs = doseHistory.filter((l) => new Date(l.logDate || l.createdAt).toDateString() === todayStr);
    if (todayLogs.length === 0) return 0;
    return Math.round((todayLogs.filter((l) => String(l.status).toLowerCase() === 'taken').length / todayLogs.length) * 100);
  }, [doseHistory]);

  const weekAdherence = useMemo(() => {
    const nonZero = weeklyAdherenceBars.filter((b) => b.percentage > 0);
    if (nonZero.length === 0) return adherenceRate;
    return Math.round(nonZero.reduce((s, b) => s + b.percentage, 0) / nonZero.length);
  }, [weeklyAdherenceBars, adherenceRate]);

  // OVERALL HEALTH SCORE
  const healthScore = useMemo(() => {
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
    if (wellnessLogs[0]?.sleepHours != null) {
      const sl = Number(wellnessLogs[0].sleepHours);
      parts.push(sl >= 7 && sl <= 9 ? 92 : sl >= 6 ? 78 : 62);
    }
    if (adherenceData.hasData || doseHistory.length > 0) {
      parts.push(adherenceRate);
    }
    return parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
  }, [latestVital, wellnessLogs, adherenceData.hasData, doseHistory.length, adherenceRate]);

  // APPOINTMENT BREAKDOWN
  const completedApts = appointments.filter((a) => a.status === 'COMPLETED').length;
  const pendingApts = appointments.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length;
  const cancelledApts = appointments.filter((a) => a.status === 'CANCELLED').length;
  const videoApts = appointments.filter((a) => a.type === 'VIDEO').length;
  const inPersonApts = appointments.filter((a) => a.type !== 'VIDEO').length;

  // TIMEFRAME-FILTERED VITALS FOR CHART
  const timeframeDays = vitalsTimeframe === '7D' ? 7 : vitalsTimeframe === '30D' ? 30 : vitalsTimeframe === '3M' ? 90 : 365;
  const filteredVitalsForChart = useMemo(() => {
    const cutoff = Date.now() - timeframeDays * 86400000;
    return vitals
      .filter((v) => {
        const ts = new Date(v.recordedAt || v.createdAt).getTime();
        return !isNaN(ts) && ts >= cutoff && extractVitalNumeric(v, selectedVitalMetric) !== null;
      })
      .slice(0, 12)
      .reverse();
  }, [vitals, timeframeDays, selectedVitalMetric]);

  const chartPoints = useMemo(() => {
    const meta = METRIC_META[selectedVitalMetric];
    if (filteredVitalsForChart.length === 0) return [];
    const vals = filteredVitalsForChart.map((v) => extractVitalNumeric(v, selectedVitalMetric) as number);
    const minVal = Math.min(meta.minY, ...vals);
    const maxVal = Math.max(meta.maxY, ...vals);
    const span = maxVal - minVal || 1;
    return filteredVitalsForChart.map((v, idx) => {
      const val = vals[idx];
      const x = filteredVitalsForChart.length === 1 ? 50 : (idx / (filteredVitalsForChart.length - 1)) * 100;
      const y = Math.max(8, Math.min(92, 92 - ((val - minVal) / span) * 80));
      return { x, y, raw: v, val };
    });
  }, [filteredVitalsForChart, selectedVitalMetric]);

  const chartAvg = useMemo(() => {
    if (chartPoints.length === 0) return null;
    const avg = chartPoints.reduce((s, p) => s + p.val, 0) / chartPoints.length;
    return selectedVitalMetric === 'Temperature' || selectedVitalMetric === 'Weight'
      ? avg.toFixed(1)
      : Math.round(avg).toString();
  }, [chartPoints, selectedVitalMetric]);

  // WEEKLY AVERAGES
  const weeklyAverages = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    const weekVitals = vitals.filter((v) => new Date(v.recordedAt || v.createdAt).getTime() >= cutoff);
    const avgOf = (fn: (v: any) => number | null, dec = 0) => {
      const nums = weekVitals.map(fn).filter((n): n is number => n !== null && !isNaN(n));
      if (nums.length === 0) return null;
      const val = nums.reduce((a, b) => a + b, 0) / nums.length;
      return dec > 0 ? val.toFixed(dec) : Math.round(val).toString();
    };
    const hr = avgOf((v) => (v.heartRate != null ? Number(v.heartRate) : null));
    const sys = avgOf((v) => (v.systolicBp != null ? Number(v.systolicBp) : null));
    const dia = avgOf((v) => (v.diastolicBp != null ? Number(v.diastolicBp) : null));
    const temp = avgOf((v) => (v.temperature != null ? Number(v.temperature) : null), 1);
    const spo2 = avgOf((v) => (v.oxygenSaturation != null ? Number(v.oxygenSaturation) : null));
    const weight = avgOf((v) => (v.weightKg != null ? Number(v.weightKg) : null), 1);
    return {
      hr: hr ? `${hr} BPM` : 'Not Recorded',
      bp: sys && dia ? `${sys}/${dia} mmHg` : 'Not Recorded',
      temp: temp ? `${temp} °F` : 'Not Recorded',
      spo2: spo2 ? `${spo2}%` : 'Not Recorded',
      weight: weight ? `${weight} kg` : 'Not Recorded',
    };
  }, [vitals]);

  // MERGED REAL ACTIVITY TIMELINE
  const activities: ActivityItem[] = useMemo(() => {
    const list: (ActivityItem & { ts: number })[] = [];

    vitals.slice(0, 8).forEach((v) => {
      const dt = new Date(v.recordedAt || v.createdAt);
      const parts = [];
      if (v.heartRate != null) parts.push(`HR ${v.heartRate} BPM`);
      if (v.systolicBp != null && v.diastolicBp != null) parts.push(`BP ${v.systolicBp}/${v.diastolicBp}`);
      if (v.oxygenSaturation != null) parts.push(`SpO₂ ${v.oxygenSaturation}%`);
      list.push({
        id: `vit-${v.id}`,
        type: 'Vital' as any,
        title: 'Vital Reading Recorded',
        subtitle: parts.length > 0 ? parts.join(' • ') : 'Biometric entry',
        date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Completed' as any,
        ts: dt.getTime() || 0,
      });
    });

    appointments.slice(0, 8).forEach((a) => {
      const dt = new Date(a.appointmentDate || a.createdAt);
      list.push({
        id: `apt-${a.id}`,
        type: 'Appointment' as any,
        title: `Consultation with ${a.doctor?.fullName || 'Specialist'}`,
        subtitle: `${a.type === 'VIDEO' ? 'Video' : 'In-Person'} • ${a.status}`,
        date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: a.slotTime || dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (a.status || 'Confirmed') as any,
        ts: dt.getTime() || 0,
      });
    });

    records.slice(0, 8).forEach((r) => {
      const dt = new Date(r.recordDate || r.createdAt);
      list.push({
        id: `rec-${r.id}`,
        type: 'Record' as any,
        title: r.title,
        subtitle: `${r.type || 'Medical Record'} • ${r.hospital || 'Vault'}`,
        date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (r.status || 'Normal') as any,
        ts: dt.getTime() || 0,
      });
    });

    doseHistory.slice(0, 8).forEach((d) => {
      const dt = new Date(d.logDate || d.createdAt);
      list.push({
        id: `dose-${d.id}`,
        type: 'Medication' as any,
        title: `${d.patientMedication?.name || 'Medication'} (${d.status})`,
        subtitle: d.patientMedication ? `${d.patientMedication.dosage} ${d.patientMedication.unit}` : 'Dose log',
        date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.takenAt || d.doseTime || dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (d.status || 'Taken') as any,
        ts: dt.getTime() || 0,
      });
    });

    return list.sort((a, b) => b.ts - a.ts);
  }, [vitals, appointments, records, doseHistory]);

  const filteredActivities = activities.filter((act) => {
    if (filters.activityType !== 'All' && act.type !== filters.activityType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!act.title.toLowerCase().includes(q) && !act.subtitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // REAL MONTHLY COMPARISONS (This Month vs Last Month)
  const monthlyComparisons = useMemo(() => {
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();

    const countInMonth = (arr: any[], dateKey: string, m: number, y: number) =>
      arr.filter((item) => {
        const d = new Date(item[dateKey] || item.createdAt);
        return !isNaN(d.getTime()) && d.getMonth() === m && d.getFullYear() === y;
      }).length;

    const curVitals = countInMonth(vitals, 'recordedAt', curMonth, curYear);
    const prevVitals = countInMonth(vitals, 'recordedAt', prevMonth, prevYear);
    const curApts = countInMonth(appointments, 'appointmentDate', curMonth, curYear);
    const prevApts = countInMonth(appointments, 'appointmentDate', prevMonth, prevYear);
    const curRecs = countInMonth(records, 'recordDate', curMonth, curYear);
    const prevRecs = countInMonth(records, 'recordDate', prevMonth, prevYear);
    const curDoses = countInMonth(doseHistory, 'logDate', curMonth, curYear);
    const prevDoses = countInMonth(doseHistory, 'logDate', prevMonth, prevYear);

    const diffLabel = (cur: number, prev: number) => {
      const d = cur - prev;
      return d > 0 ? `+${d}` : `${d}`;
    };

    return [
      { label: 'Vital Readings Logged', currentValue: `${curVitals}`, previousValue: `${prevVitals}`, change: diffLabel(curVitals, prevVitals) },
      { label: 'Appointments Scheduled', currentValue: `${curApts}`, previousValue: `${prevApts}`, change: diffLabel(curApts, prevApts) },
      { label: 'Medical Records Added', currentValue: `${curRecs}`, previousValue: `${prevRecs}`, change: diffLabel(curRecs, prevRecs) },
      { label: 'Medication Doses Logged', currentValue: `${curDoses}`, previousValue: `${prevDoses}`, change: diffLabel(curDoses, prevDoses) },
    ];
  }, [vitals, appointments, records, doseHistory]);

  // CURRENT MONTH CALENDAR DAYS & ACTIVITY DOTS
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const activeDaysSet = useMemo(() => {
    const s = new Set<number>();
    const collect = (dateStr?: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        s.add(d.getDate());
      }
    };
    vitals.forEach((v) => collect(v.recordedAt));
    appointments.forEach((a) => collect(a.appointmentDate));
    records.forEach((r) => collect(r.recordDate || r.createdAt));
    doseHistory.forEach((d) => collect(d.logDate || d.createdAt));
    return s;
  }, [vitals, appointments, records, doseHistory]);

  const vitalsSummaryCards = [
    {
      id: 'Heart Rate',
      label: t('card.heart_rate', 'Heart Rate'),
      val: latestVital?.heartRate != null ? String(latestVital.heartRate) : '—',
      unit: latestVital?.heartRate != null ? 'BPM' : 'No data',
      icon: Heart,
      iconBg: 'bg-rose-500/20',
      iconColor: 'text-rose-500',
      status: latestVital?.heartRate != null ? (latestVital.heartRate >= 60 && latestVital.heartRate <= 100 ? 'Normal' : 'Monitor') : 'Not Recorded',
      sparkline: 'M0,10 L5,8 L10,12 L15,4 L20,10',
      activeBorder: 'border-rose-500',
      glow: 'bg-rose-500/10',
    },
    {
      id: 'Blood Pressure',
      label: t('card.blood_pressure', 'Blood Pressure'),
      val: latestVital?.systolicBp != null && latestVital?.diastolicBp != null ? `${latestVital.systolicBp}/${latestVital.diastolicBp}` : '—',
      unit: latestVital?.systolicBp != null ? 'mmHg' : 'No data',
      icon: Activity,
      iconBg: 'bg-indigo-500/20',
      iconColor: 'text-indigo-400',
      status: latestVital?.systolicBp != null ? (latestVital.systolicBp <= 130 ? 'Normal' : 'Elevated') : 'Not Recorded',
      sparkline: 'M0,10 L5,5 L10,12 L15,8 L20,10',
      activeBorder: 'border-indigo-500',
      glow: 'bg-indigo-500/10',
    },
    {
      id: 'Temperature',
      label: t('analytics.temperature', 'Temperature'),
      val: latestVital?.temperature != null ? String(latestVital.temperature) : '—',
      unit: latestVital?.temperature != null ? '°F' : 'No data',
      icon: Thermometer,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-500',
      status: latestVital?.temperature != null ? (latestVital.temperature <= 99.5 ? 'Normal' : 'Elevated') : 'Not Recorded',
      sparkline: 'M0,10 L5,10 L10,8 L15,11 L20,10',
      activeBorder: 'border-amber-500',
      glow: 'bg-amber-500/10',
    },
    {
      id: 'SpO2',
      label: t('card.blood_spo2', 'SpO₂ • Oxygen'),
      val: latestVital?.oxygenSaturation != null ? String(latestVital.oxygenSaturation) : '—',
      unit: latestVital?.oxygenSaturation != null ? '%' : 'No data',
      icon: Wind,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
      status: latestVital?.oxygenSaturation != null ? (latestVital.oxygenSaturation >= 95 ? 'Normal' : 'Low') : 'Not Recorded',
      sparkline: 'M0,10 L5,9 L10,10 L15,7 L20,10',
      activeBorder: 'border-blue-500',
      glow: 'bg-blue-500/10',
    },
    {
      id: 'Weight',
      label: t('analytics.weight', 'Body Weight'),
      val: latestVital?.weightKg != null ? String(latestVital.weightKg) : (patientProfile?.weightKg != null ? String(patientProfile.weightKg) : '—'),
      unit: (latestVital?.weightKg != null || patientProfile?.weightKg != null) ? 'kg' : 'No data',
      icon: Scale,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-500',
      status: (latestVital?.weightKg != null || patientProfile?.weightKg != null) ? 'Recorded' : 'Not Recorded',
      sparkline: 'M0,10 L5,12 L10,10 L15,14 L20,10',
      activeBorder: 'border-emerald-500',
      glow: 'bg-emerald-500/10',
    },
  ];

  const activeMetricColor = METRIC_META[selectedVitalMetric]?.color || '#ff4d6d';
  const activePoint = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1] : null;
  const donutDashOffset = 276.46 - (276.46 * healthScore) / 100;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20 font-sans">
      {/* TOAST NOTIFICATION */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto select-auto bg-[#00a896] text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-teal-300/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 1. PAGE HEADER */}
      <PageHeader
        title={t('analytics.title', 'Health Analytics & Biometric Insights')}
        subtitle={t('analytics.subtitle', 'Understand your health activity, trend analytics and biometrics in one place.')}
        badgeText={t('analytics.overview_tab', 'Analytics Workspace')}
        badgeIcon={<BarChart3 className="w-3.5 h-3.5" />}
        rightElement={
          <div className="flex items-center gap-3 self-stretch sm:self-auto font-sans">
            <select
              value={globalDateRange}
              onChange={(e) => {
                setGlobalDateRange(e.target.value);
                if (e.target.value === '7 Days') setVitalsTimeframe('7D');
                else if (e.target.value === '30 Days') setVitalsTimeframe('30D');
                else if (e.target.value === '3 Months') setVitalsTimeframe('3M');
                else setVitalsTimeframe('1Y');
                showToast(`Updated timeframe to ${e.target.value}`);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white font-bold text-xs focus:outline-none focus:border-teal-500 cursor-pointer shadow-sm"
            >
              <option value="7 Days">7 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="3 Months">3 Months</option>
              <option value="6 Months">6 Months</option>
              <option value="1 Year">1 Year</option>
            </select>

            <button
              onClick={() => setReportModalOpen(true)}
              className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-[#00a896] hover:bg-[#00897b] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t('analytics.export_report', 'Export Report')}</span>
            </button>
          </div>
        }
      />

      {/* 2. HEALTH OVERVIEW HERO SECTION */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden font-sans">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #00a896 0%, transparent 50%), radial-gradient(circle at 20% 20%, #475569 0%, transparent 30%)' }}></div>
        <svg className="absolute right-0 top-0 h-full w-2/3 opacity-10 pointer-events-none text-[#00a896] dark:text-teal-500" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path fill="none" stroke="currentColor" strokeWidth="1" d="M10,10 Q150,200 390,10" />
          <path fill="none" stroke="currentColor" strokeWidth="1" d="M10,190 Q150,0 390,190" />
          <circle cx="200" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="200" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,4" />
        </svg>

        <div className="space-y-4 text-center md:text-left flex-1 relative z-10">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00a896] dark:text-cyan-400 font-mono">
            {t('analytics.accuracy_report', 'Personal Health Accuracy Report')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{t('analytics.activity_glance', 'Your health activity at a glance')}</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-medium">
            {healthScore > 0 ? (
              <>
                Consolidated personal health score:{' '}
                <strong className="text-[#00a896] dark:text-teal-400">
                  {healthScore >= 85 ? 'Optimal' : healthScore >= 70 ? 'Good' : 'Moderate'} ({healthScore}/100)
                </strong>{' '}
                computed from {vitals.length} vital reading{vitals.length === 1 ? '' : 's'} and {doseHistory.length} dose log{doseHistory.length === 1 ? '' : 's'}.
              </>
            ) : (
              'No vitals or adherence data logged yet. Record your vitals and medications to unlock live health analytics.'
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2 rounded-full font-extrabold text-xs text-white bg-[#00a896] hover:bg-[#00897b] transition-all shadow-md cursor-pointer">
              {t('nav.dashboard', 'Dashboard Overview')}
            </button>
            <button onClick={() => onNavigate('records')} className="px-5 py-2 rounded-full font-extrabold text-xs text-white bg-amber-500 hover:bg-amber-600 transition-all shadow-md cursor-pointer">
              {t('records.title', 'View Health Vault')}
            </button>
          </div>
        </div>

        {/* CIRCULAR HEALTH SCORE VISUALIZATION */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 text-center space-y-2 shrink-0 min-w-[220px] shadow-lg relative z-10">
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            <div className="absolute inset-2 bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/50 dark:to-slate-800 rounded-full opacity-70"></div>
            <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 36 36">
              <path
                className="text-slate-200/50 dark:text-slate-800/50"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#00a896] dark:text-teal-400"
                strokeDasharray={`${healthScore}, 100`}
                strokeWidth="4"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center z-10">
              <span className="font-sans text-3xl font-extrabold text-slate-900 dark:text-white leading-none">{healthScore}</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">score</span>
            </div>
          </div>

          <div className="space-y-0.5 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block font-sans">
              {t('card.health_score', 'Total Health Score')}
            </span>
            <span className="text-[11px] font-bold text-[#00a896] dark:text-teal-400 inline-flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {vitals.length > 0 ? `${vitals.length} vitals synced` : 'No data yet'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. KEY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('analytics.med_adherence', 'Medication Adherence')}</span>
            <Pill className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-sans">{adherenceRate}%</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium relative z-10">
            {doseHistory.length > 0 ? `${doseHistory.length} doses logged` : 'No dose logs yet'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('nav.appointments', 'Appointments')}</span>
            <CalendarIcon className="w-4 h-4 text-[#00a896] dark:text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#00a896] dark:text-cyan-400 font-sans">{appointments.length}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">visits</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
            {pendingApts} upcoming · {completedApts} completed
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('nav.records', 'Medical Records')}</span>
            <FileText className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-sans">{records.length}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">records</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
            Synced in ABDM Health Vault
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('nav.consultation', 'Video Consultations')}</span>
            <Video className="w-4 h-4 text-[#00a896] dark:text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#00a896] dark:text-teal-400 font-sans">{videoApts}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">sessions</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
            {inPersonApts} in-person clinic visit{inPersonApts === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* 4. VITALS OVERVIEW & INTERACTIVE TREND CHARTS */}
      <div className="bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-800/60 rounded-[1.5rem] p-3.5 sm:p-4 space-y-3 shadow-xl font-sans text-slate-900 dark:text-white">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-inner">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold tracking-wide">{t('analytics.vitals_overview', 'Vitals Overview')}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[#00a896]/10 text-[#00a896] border border-[#00a896]/30 flex items-center gap-1.5 shadow-sm uppercase tracking-wider backdrop-blur-sm">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a896] opacity-75"></span>
                  <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#00a896] shadow-[0_0_8px_#00a896]"></span>
                </span>
                {vitals.length > 0 ? t('analytics.systems_normal', 'Live Vitals Synced') : 'No Vitals Yet'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">{t('analytics.track_vitals_desc', 'Track heart rate, blood pressure & vital metrics')}</p>
          </div>

          {/* TIMEFRAME SELECTOR */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-slate-200/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 text-[10px] font-sans shadow-inner">
            {(['7D', '30D', '3M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setVitalsTimeframe(tf)}
                className={`px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  vitalsTimeframe === tf ? 'bg-blue-600/90 text-white shadow-[0_0_12px_rgba(37,99,235,0.6)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* METRIC TOGGLES GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {vitalsSummaryCards.map((m) => {
            const isSelected = selectedVitalMetric === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedVitalMetric(m.id as any)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden ${
                  isSelected
                    ? `bg-slate-900/5 dark:bg-[#1a1f33] ${m.activeBorder} ring-2 ring-indigo-500/40 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]`
                    : 'bg-white dark:bg-[#15192b] border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-[#1a1f33]'
                }`}
              >
                <div className={`absolute -top-4 -left-4 w-32 h-32 ${m.glow} blur-2xl pointer-events-none rounded-full transition-opacity duration-500 ${isSelected ? 'opacity-100' : 'opacity-50'}`}></div>
                <div className="flex items-center gap-2.5 z-10">
                  <div className={`p-2 rounded-lg ${m.iconBg} ${m.iconColor} shadow-inner`}>
                    <m.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block leading-tight">{m.label}</span>
                    <div className="flex items-baseline gap-1 mt-0">
                      <span className="font-sans font-bold text-xl text-slate-900 dark:text-white leading-tight">{m.val}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{m.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50 z-10 my-0"></div>
                <div className="flex items-center justify-between w-full z-10">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20 leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {m.status}
                  </span>
                  <svg className={`w-6 h-3 ${m.iconColor}`} viewBox="0 0 20 20" preserveAspectRatio="none">
                    <path d={m.sparkline} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {/* MIDDLE SECTION: MAIN CHART & TODAY'S SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Main Chart (Left 8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-[#0b132b] border border-slate-200 dark:border-slate-800/80 rounded-[20px] p-6 sm:p-8 relative overflow-hidden flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-900/10 blur-[100px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Heart className={`w-5 h-5 ${selectedVitalMetric === 'Heart Rate' ? 'text-[#ff4d6d]' : 'text-slate-400'}`} fill={selectedVitalMetric === 'Heart Rate' ? 'currentColor' : 'none'} />
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{selectedVitalMetric} TREND</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Last {timeframeDays} days · {chartPoints.length} recorded reading{chartPoints.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 flex items-center gap-2 shadow-sm backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></span>
                <span className="text-[10px] text-slate-700 dark:text-slate-200 font-bold tracking-wide">
                  {chartPoints.length > 0 ? 'Live DB' : 'No Data'}
                </span>
              </div>
            </div>

            {/* Chart Area */}
            {chartPoints.length === 0 ? (
              <div className="w-full h-[260px] flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Activity className="w-8 h-8 mb-2 opacity-40" />
                <p className="font-bold">No {selectedVitalMetric.toLowerCase()} readings recorded in the last {timeframeDays} days.</p>
                <p className="text-[11px] mt-1">Log vitals from your dashboard to visualize trends here.</p>
              </div>
            ) : (
              <div className="w-full relative pb-8 pl-8 pr-2 flex items-end h-[260px] mt-2">
                <div className="w-full h-full relative z-10">
                  <svg key={vitalsTimeframe + selectedVitalMetric} className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="chartGradientPremium" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={activeMetricColor} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={activeMetricColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <path
                      d={`${generateSmoothPath(chartPoints)} L100,100 L0,100 Z`}
                      fill="url(#chartGradientPremium)"
                    />
                    <path
                      d={generateSmoothPath(chartPoints)}
                      fill="none"
                      stroke={activeMetricColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ filter: `drop-shadow(0 4px 8px ${activeMetricColor}60)` }}
                    />
                    {chartPoints.map((point, i) => (
                      <circle
                        key={`pt-${i}`}
                        cx={point.x}
                        cy={point.y}
                        r={i === chartPoints.length - 1 ? '4.5' : '2.8'}
                        fill="#ffffff"
                        stroke={activeMetricColor}
                        strokeWidth={i === chartPoints.length - 1 ? '3' : '2'}
                      />
                    ))}
                  </svg>

                  {/* Latest Reading Callout */}
                  {activePoint && (
                    <div className="absolute top-2 right-2 z-20 bg-[#0f172a] border border-slate-700/60 rounded-2xl px-4 py-2.5 shadow-xl text-white">
                      <div className="text-base font-black leading-none mb-1">
                        {formatVitalDisplay(activePoint.raw, selectedVitalMetric)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(activePoint.raw.recordedAt || activePoint.raw.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* X-axis labels from real dates */}
                <div className="absolute bottom-[-20px] left-8 right-2 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {chartPoints.slice(0, 6).map((pt, i) => (
                    <span key={i}>
                      {new Date(pt.raw.recordedAt || pt.raw.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  ))}
                </div>

                {chartAvg && (
                  <div className="absolute right-2 bottom-6 text-[10px] text-slate-400 font-bold bg-slate-800/30 px-2.5 py-1 rounded-md backdrop-blur-sm z-20 border border-slate-700/30">
                    Avg ({vitalsTimeframe}): {chartAvg} {METRIC_META[selectedVitalMetric]?.unit}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Today's Summary (Right 4 cols) */}
          <div className="lg:col-span-4 bg-white/90 dark:bg-[#15192b]/90 backdrop-blur-lg border border-slate-200/80 dark:border-slate-700/50 rounded-xl p-3.5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CalendarIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-[13px] font-bold text-slate-900 dark:text-white tracking-wide">Latest Vitals Summary</span>
            </div>

            <div className="flex justify-center my-1.5">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-xl pointer-events-none"></div>
                <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="url(#donutGradient)"
                    strokeWidth="8"
                    strokeDasharray="276.46"
                    strokeDashoffset={donutDashOffset}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="donutGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute text-center flex flex-col items-center justify-center pt-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tighter leading-none">
                    {healthScore}<span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold ml-0.5">%</span>
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest mt-1 leading-none">Health Score</span>
                </div>
              </div>
            </div>

            <div className="space-y-0.5 text-xs">
              {vitalsSummaryCards.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1.5 px-0.5 border-b border-slate-200 dark:border-slate-800/40 last:border-0">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <v.icon className={`w-3.5 h-3.5 ${v.iconColor}`} />
                    <span className="font-medium text-[11px] tracking-wide">{v.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 tracking-wide">{v.status}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setReportModalOpen(true)}
              className="mt-2 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
            >
              View Full Report <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: 3 PANELS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Health Insights */}
          <div className="bg-white/90 dark:bg-[#15192b]/90 backdrop-blur-lg border border-slate-200/80 dark:border-slate-700/50 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span className="text-[13px] font-bold text-slate-900 dark:text-white tracking-wide">Health Insights</span>
            </div>
            <div className="bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-rose-900/20 rounded-lg p-2.5 flex gap-2 items-center relative overflow-hidden">
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium relative z-10 w-2/3">
                {latestVital?.heartRate != null
                  ? `Latest heart rate is ${latestVital.heartRate} BPM${latestVital.systolicBp ? ` and BP is ${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg` : ''}. Keep logging consistently.`
                  : 'Log your vitals regularly to receive automated cardiovascular and wellness insights.'}
              </p>
              <div className="shrink-0 relative z-10 flex-1 flex justify-end">
                <Heart className="w-8 h-8 text-rose-500" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Weekly Averages */}
          <div className="bg-white/90 dark:bg-[#15192b]/90 backdrop-blur-lg border border-slate-200/80 dark:border-slate-700/50 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-[13px] font-bold text-slate-900 dark:text-white tracking-wide">7-Day Averages</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Heart Rate', val: weeklyAverages.hr, icon: Heart, color: 'text-rose-500' },
                { label: 'Blood Pressure', val: weeklyAverages.bp, icon: Activity, color: 'text-indigo-400' },
                { label: 'Temperature', val: weeklyAverages.temp, icon: Thermometer, color: 'text-amber-500' },
                { label: 'SpO₂', val: weeklyAverages.spo2, icon: Wind, color: 'text-blue-500' },
                { label: 'Body Weight', val: weeklyAverages.weight, icon: Scale, color: 'text-emerald-500' },
              ].map((v, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] px-0.5">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <v.icon className={`w-3.5 h-3.5 ${v.color}`} />
                    <span className="font-medium tracking-wide text-xs">{v.label}</span>
                  </div>
                  <span className={`font-bold tracking-wide text-xs ${v.color}`}>{v.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Vitals Activity */}
          <div className="bg-white/90 dark:bg-[#15192b]/90 backdrop-blur-lg border border-slate-200/80 dark:border-slate-700/50 rounded-xl p-3.5 relative shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-[13px] font-bold text-slate-900 dark:text-white tracking-wide">Recent Readings</span>
              </div>
            </div>
            {vitals.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 py-4 text-center">No vital readings recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {vitals.slice(0, 3).map((v) => {
                  const summary = v.heartRate
                    ? `${v.heartRate} BPM`
                    : v.systolicBp
                      ? `${v.systolicBp}/${v.diastolicBp}`
                      : v.oxygenSaturation
                        ? `${v.oxygenSaturation}% SpO₂`
                        : 'Logged';
                  const timeStr = new Date(v.recordedAt || v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800/40 last:border-0 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Vitals Recorded</span>
                      <div className="flex gap-2.5 items-center">
                        <span className="font-bold text-teal-600 dark:text-teal-400">{summary}</span>
                        <span className="text-[10px] text-slate-500">{timeStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. MEDICATION ADHERENCE & APPOINTMENT ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
        {/* MEDICATION ADHERENCE */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Medication Adherence</h3>
            </div>
            <button
              onClick={() => onNavigate('medicines')}
              className="px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-[#00a896] dark:text-teal-400 text-xs font-bold border border-teal-100 dark:border-teal-800 flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>View medicines</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center text-xs font-sans shadow-sm">
            <div className="border-r border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Today</span>
              <span className="font-sans font-extrabold text-slate-800 dark:text-slate-200 text-lg">{todayAdherence}%</span>
            </div>
            <div className="border-r border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">This Week</span>
              <span className="font-sans font-extrabold text-[#00a896] dark:text-teal-400 text-lg">{weekAdherence}%</span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Overall</span>
              <span className="font-sans font-extrabold text-[#00a896] dark:text-teal-400 text-lg">{adherenceRate}%</span>
            </div>
          </div>

          {/* WEEKLY ADHERENCE BARS */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">Weekly adherence (%)</span>
            <div className="grid grid-cols-7 gap-2 items-end h-24 bg-white dark:bg-slate-950 p-2 text-center">
              {weeklyAdherenceBars.map((day, idx) => (
                <div key={`${day.day}-${idx}`} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    style={{ height: `${Math.max(4, day.percentage)}%` }}
                    className="w-4 rounded-t-sm bg-[#00a896] dark:bg-teal-400"
                    title={`${day.day}: ${day.percentage}%`}
                  />
                  <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* APPOINTMENT & CONSULTATION ANALYTICS */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#00a896] dark:text-teal-400" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Appointments & Consultations</h3>
            </div>
            <button
              onClick={() => onNavigate('appointments')}
              className="px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-[#00a896] dark:text-teal-400 text-xs font-bold border border-teal-100 dark:border-teal-800 flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>View appointments</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center text-xs shadow-sm">
            <div className="border-r border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Completed</span>
              <span className="font-sans font-extrabold text-[#00a896] dark:text-teal-400 text-lg">{completedApts}</span>
            </div>
            <div className="border-r border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Upcoming</span>
              <span className="font-sans font-extrabold text-amber-500 text-lg">{pendingApts}</span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Cancelled</span>
              <span className="font-sans font-extrabold text-rose-500 text-lg">{cancelledApts}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-3 text-xs shadow-inner">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">Appointment summary</h4>
            <div className="space-y-2 text-slate-600 dark:text-slate-400 font-medium">
              <div className="flex justify-between items-center"><span className="text-[11px]">Total Consultations</span><span className="font-extrabold text-slate-900 dark:text-white text-[10px]">{appointments.length} sessions</span></div>
              <div className="flex justify-between items-center"><span className="text-[11px]">Video calls</span><span className="font-extrabold text-[#00a896] dark:text-teal-400 text-[10px]">{videoApts} calls</span></div>
              <div className="flex justify-between items-center"><span className="text-[11px]">In-person visits</span><span className="font-extrabold text-teal-600 dark:text-teal-500 text-[10px]">{inPersonApts} visits</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. HEALTH ACTIVITY TIMELINE & INTERACTIVE CALENDAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm font-sans">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Health Activity Timeline & Calendar</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Live health activity log synchronized from MySQL records</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#00a896]"
              />
            </div>
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className="p-2 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm transition-all"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ACTIVITY STREAM TIMELINE */}
          <div className="lg:col-span-7 space-y-0 relative">
            {filteredActivities.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No health activity logged yet.
              </div>
            ) : (
              <>
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-800 z-0"></div>
                {filteredActivities.slice(0, 8).map((act) => (
                  <div key={act.id} className="relative z-10 flex items-start gap-4 py-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#00a896] dark:text-teal-400 flex items-center justify-center shadow-sm">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex-1 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">{act.title}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{act.subtitle}</p>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="text-[10px] text-slate-500 block font-medium">{act.date}</span>
                        <span className="text-[10px] font-bold text-[#00a896] dark:text-teal-400">{act.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* COMPACT INTERACTIVE MONTHLY CALENDAR */}
          <div className="lg:col-span-5 bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="font-extrabold text-slate-900 dark:text-white">{currentMonthLabel}</span>
              <span className="font-sans text-[10px] text-slate-500 font-medium">{selectedCalendarDate}</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-sans">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <span key={idx} className="font-bold text-slate-500 dark:text-slate-400 py-1">{d}</span>
              ))}
              {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map((d) => {
                const monthShort = now.toLocaleDateString('en-GB', { month: 'short' });
                const dateStr = `${d.toString().padStart(2, '0')} ${monthShort} ${now.getFullYear()}`;
                const isSelected = selectedCalendarDate === dateStr;
                const hasDot = activeDaysSet.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedCalendarDate(dateStr)}
                    className={`h-8 w-full rounded-md font-bold transition-colors cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[#00a896] text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{d}</span>
                    {hasDot && !isSelected && <span className="w-1 h-1 rounded-full bg-[#00a896] mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 7. HEALTH GOALS & WELLNESS METRICS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm font-sans">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#00a896] dark:text-teal-400" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('analytics.health_goals', 'Personal Health Goals')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Track active wellness targets persisted to MySQL</p>
            </div>
          </div>

          <button
            onClick={() => setCreateGoalModalOpen(true)}
            className="px-5 py-2 rounded-full font-extrabold text-xs text-white bg-[#00a896] hover:bg-[#00897b] transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{t('analytics.create_goal', 'Add Goal')}</span>
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No personal health goals created yet. Click "Add Goal" to start tracking.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {goals.map((g) => (
              <div key={g.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{g.title}</span>
                  <span className="text-[10px] font-sans font-bold text-[#00a896] dark:text-teal-400">{g.progress}%</span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div style={{ width: `${g.progress}%` }} className="h-full bg-[#00a896] dark:bg-teal-400" />
                </div>

                <div className="flex justify-between items-baseline text-[10px] font-sans">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Target: <strong className="text-slate-700 dark:text-slate-300">{g.target} {g.unit}</strong></span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Current: <strong className="text-slate-700 dark:text-slate-300">{g.current}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. INSIGHTS & MONTHLY COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-[#00a896] dark:text-cyan-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('analytics.activity_insights', 'Health Activity Insights')}</h3>
          </div>

          <div className="space-y-3 text-xs font-medium">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1 shadow-sm">
              <h4 className="font-bold text-[#00a896] dark:text-teal-400">Medication Health Tracking</h4>
              <p className="text-slate-500 dark:text-slate-400">
                {doseHistory.length > 0
                  ? `${adherenceRate}% overall adherence across ${doseHistory.length} logged dose${doseHistory.length === 1 ? '' : 's'}.`
                  : 'No medication dose logs recorded yet.'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1 shadow-sm">
              <h4 className="font-bold text-[#00a896] dark:text-teal-400">Appointment History</h4>
              <p className="text-slate-500 dark:text-slate-400">
                {appointments.length > 0
                  ? `${appointments.length} total appointment${appointments.length === 1 ? '' : 's'} (${completedApts} completed, ${pendingApts} upcoming).`
                  : 'No doctor appointments scheduled yet.'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1 shadow-sm">
              <h4 className="font-bold text-[#00a896] dark:text-teal-400">Medical Records Synced</h4>
              <p className="text-slate-500 dark:text-slate-400">
                {records.length > 0
                  ? `${records.length} medical document${records.length === 1 ? '' : 's'} securely stored in your ABDM vault.`
                  : 'Upload medical reports to build your longitudinal health record.'}
              </p>
            </div>
          </div>
        </div>

        {/* MONTHLY COMPARISON TABLE */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <BarChart3 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('analytics.monthly_comparison', 'This Month vs Previous Month')}</h3>
          </div>

          <div className="space-y-3 text-xs">
            {monthlyComparisons.map((comp, i) => (
              <div key={i} className="py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{comp.label}</h4>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Current: {comp.currentValue} vs Previous: {comp.previousValue}</span>
                </div>
                <span className="font-sans font-bold text-[#00a896] dark:text-teal-400 text-[10px] bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full border border-teal-100 dark:border-teal-800">
                  {comp.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
      <CreateGoalModal
        isOpen={createGoalModalOpen}
        onClose={() => setCreateGoalModalOpen(false)}
        onSaveGoal={handleSaveGoal}
      />

      <ReportPreviewModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        dateRange={globalDateRange}
        reportData={{
          patientName: patientProfile?.fullName || user?.name || 'Patient',
          abhaId: patientProfile?.user?.abhaId || patientProfile?.abhaId || user?.abhaId || 'Not Linked',
          healthScore,
          adherencePct: adherenceRate,
          totalAppointments: appointments.length,
          videoConsultations: videoApts,
          totalRecords: records.length,
          vitals,
          doseHistory,
        }}
      />

      <AnalyticsFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={(f) => setFilters(f)}
        onResetFilters={() => setFilters({ activityType: 'All', status: 'All', dateRange: '30 Days' })}
      />
    </div>
  );
};
