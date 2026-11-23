import React, { useState, useMemo, useEffect } from 'react';
import { patientExtendedApi, recordApi, profileApi } from '../../../services/dhrApis';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Microscope, FileText, Calendar, Activity, Download, X, Clock, MapPin, AlertCircle, 
  CheckCircle2, FileCheck, Zap, ShieldCheck, ChevronDown, Search, Filter, RefreshCw, 
  Bell, CheckSquare, Square, Share2, Info, ArrowRight, TestTube, ArrowUpRight
} from 'lucide-react';

type TestStatus = 'Scheduled' | 'Completed' | 'Cancelled';
type ReportStatus = 'Normal' | 'Attention' | 'Borderline';

export const LabTestView: React.FC = () => {
  // --- STATE ---
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isPreparationModalOpen, setIsPreparationModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFullTrendsModalOpen, setIsFullTrendsModalOpen] = useState(false);
  const [isAllTestsModalOpen, setIsAllTestsModalOpen] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedUpcomingTest, setSelectedUpcomingTest] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');

  // Trends
  const [selectedTrendMetric, setSelectedTrendMetric] = useState('HbA1c');
  
  // Reminder & Prep
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [prepChecklist, setPrepChecklist] = useState({
    fasting: true,
    water: true,
    exercise: false,
    reports: false,
    id: false
  });

  // Form State
  const [testType, setTestType] = useState('Complete Blood Count (CBC)');
  const [testDate, setTestDate] = useState('');
  const [testTime, setTestTime] = useState('08:00 AM');

  // --- DATA (Hydrated from MySQL) ---
  const [upcomingTests, setUpcomingTests] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [rawBookings, setRawBookings] = useState<any[]>([]);
  const [patientDisplay, setPatientDisplay] = useState({ name: 'Patient', ageSex: 'Not Recorded' });

  const loadLabTests = async () => {
    try {
      const [bookingsRes, recordsRes, profRes] = await Promise.all([
        patientExtendedApi.getLabTests().catch(() => null),
        recordApi.getMedicalRecords().catch(() => null),
        profileApi.getPatientProfile().catch(() => null),
      ]);

      const pat: any = profRes?.data;
      if (pat) {
        const age = pat.dateOfBirth
          ? Math.max(1, new Date().getFullYear() - new Date(pat.dateOfBirth).getFullYear())
          : null;
        setPatientDisplay({
          name: pat.fullName || 'Patient',
          ageSex: age ? `${age} / ${(pat.gender || 'N/A').slice(0, 1).toUpperCase()}` : (pat.gender || 'Not Recorded'),
        });
      }

      const bookingsList = Array.isArray(bookingsRes?.data) ? bookingsRes!.data : [];
      setRawBookings(bookingsList);
      setUpcomingTests(
        bookingsList.map((t: any) => ({
          id: t.id,
          title: t.testName,
          date: t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Scheduled',
          time: t.scheduledTime || '08:00 AM',
          method: t.collectionType || 'Home Collection',
          fasting: String(t.testName || '').toLowerCase().includes('lipid') || String(t.testName || '').toLowerCase().includes('blood'),
          status: (t.status || 'Scheduled') as TestStatus,
          icon: 'activity',
          instructions: [t.notes || 'Phlebotomist assigned'],
        }))
      );

      const recordsList = Array.isArray(recordsRes?.data) ? recordsRes!.data : [];
      const labRecords = recordsList
        .filter((r: any) => String(r.type || '').toUpperCase() === 'LAB_REPORT')
        .map((r: any) => {
          const rawSt = String(r.status || 'Normal').toLowerCase();
          const mappedStatus: ReportStatus = rawSt.includes('attention') || rawSt.includes('critical') || rawSt.includes('high')
            ? 'Attention'
            : rawSt.includes('borderline') || rawSt.includes('pending')
            ? 'Borderline'
            : 'Normal';
          return {
            id: r.id,
            title: r.title,
            date: r.recordDate ? new Date(r.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            status: mappedStatus,
            dr: r.hospital || 'Diagnostic Lab',
            notes: r.notes || '',
            fileUrl: r.fileUrl || null,
          };
        });

      const completedBookingReports = bookingsList
        .filter((b: any) => String(b.status || '').toLowerCase() === 'completed' || b.resultValue)
        .map((b: any) => ({
          id: `BK-${b.id}`,
          title: b.testName,
          date: b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          status: 'Normal' as ReportStatus,
          dr: b.labName || 'Certified Diagnostics Lab',
          resultValue: b.resultValue,
          resultUnit: b.resultUnit,
          referenceRange: b.referenceRange,
          notes: b.notes || '',
          fileUrl: b.reportUrl || null,
        }));

      setReports([...labRecords, ...completedBookingReports]);
    } catch {
      setUpcomingTests([]);
      setReports([]);
    }
  };

  useEffect(() => {
    loadLabTests();
  }, []);

  const popularTests = [
    { name: 'Complete Blood Count', desc: 'Blood cell health', price: '$45' },
    { name: 'Thyroid Panel', desc: 'Thyroid function', price: '$60' },
    { name: 'Vitamin D', desc: 'Vitamin levels', price: '$50' },
    { name: 'Lipid Profile', desc: 'Cholesterol levels', price: '$40' },
    { name: 'HbA1c', desc: 'Blood sugar (3 mo)', price: '$35' }
  ];

  const trendDataMap = useMemo(() => {
    const map: Record<string, { labels: string[]; values: number[]; min: number; max: number; normalRange: [number, number] }> = {};
    const metrics = ['HbA1c', 'Vitamin D', 'Cholesterol', 'Hemoglobin'];
    metrics.forEach((metric) => {
      const matching = rawBookings
        .filter((b: any) =>
          String(b.testName || '').toLowerCase().includes(metric.toLowerCase()) &&
          b.resultValue !== null &&
          b.resultValue !== undefined &&
          !isNaN(Number(b.resultValue))
        )
        .sort((a: any, b: any) => new Date(a.scheduledDate || a.createdAt).getTime() - new Date(b.scheduledDate || b.createdAt).getTime());

      if (matching.length > 0) {
        const vals = matching.map((b: any) => Number(b.resultValue));
        const labels = matching.map((b: any) =>
          new Date(b.scheduledDate || b.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        );
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const pad = Math.max(1, (maxV - minV) * 0.25);
        map[metric] = {
          labels,
          values: vals,
          min: Math.max(0, minV - pad),
          max: maxV + pad,
          normalRange: [minV, maxV],
        };
      }
    });
    return map;
  }, [rawBookings]);

  // --- ACTIONS ---
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleBookTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientExtendedApi.createLabTest({
        testName: testType,
        scheduledDate: testDate || new Date().toISOString(),
        scheduledTime: testTime,
        collectionType: 'Home Collection',
      });
      await loadLabTests();
      setIsBookingModalOpen(false);
      showToast('Lab test booking saved to MySQL!');
      setTestDate('');
    } catch {
      showToast('Failed to book lab test');
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUpcomingTest?.id) return;
    try {
      await patientExtendedApi.updateLabTest(String(selectedUpcomingTest.id), {
        status: 'Scheduled',
        notes: `Rescheduled to ${testDate || selectedUpcomingTest.date} at ${testTime}`,
      });
      await loadLabTests();
      setIsRescheduleModalOpen(false);
      setSelectedUpcomingTest(null);
      showToast('Test rescheduled in database!');
    } catch {
      showToast('Failed to reschedule test');
    }
  };

  // --- HELPERS ---
  const getTestStatusColor = (status: TestStatus | ReportStatus) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      case 'Completed': 
      case 'Normal': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
      case 'Cancelled': 
      case 'Attention': return 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border-rose-200 dark:border-rose-800/50';
      case 'Borderline': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const toggleChecklist = (key: keyof typeof prepChecklist) => {
    setPrepChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- FILTERING ---
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.dr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchDate = dateFilter === 'All' || r.date.includes(dateFilter);
      return matchSearch && matchStatus && matchDate;
    });
  }, [reports, searchQuery, statusFilter, dateFilter]);

  const filteredUpcoming = useMemo(() => {
    return upcomingTests.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'All' || t.status === statusFilter || statusFilter === 'Scheduled'; // simple mapping
      const matchDate = dateFilter === 'All' || t.date.includes(dateFilter);
      return matchSearch && matchStatus && matchDate;
    });
  }, [upcomingTests, searchQuery, statusFilter, dateFilter]);

  // --- TREND CHART RENDERER ---
  const renderTrendChart = () => {
    const data = trendDataMap[selectedTrendMetric];
    if (!data || data.values.length === 0) {
      return (
        <div className="relative w-full h-[200px] mt-4 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
          <Activity className="w-7 h-7 text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No {selectedTrendMetric} trend data recorded yet</p>
          <p className="text-xs text-slate-500 mt-1">Completed lab test results with numeric values will appear here automatically.</p>
        </div>
      );
    }
    const { labels, values, min, max } = data;
    
    // Simple SVG line chart logic
    const height = 150;
    const width = 350;
    const padX = 35; // left padding for y-labels
    const padRight = 15;
    const padY = 25; // top/bottom padding
    
    const range = Math.max(0.1, max - min);
    
    const points = values.map((val, i) => {
      const denom = Math.max(1, values.length - 1);
      const x = padX + (values.length === 1 ? (width - padX - padRight) / 2 : (i / denom) * (width - padX - padRight));
      const y = height - padY - ((val - min) / range) * (height - 2 * padY);
      return `${x},${y}`;
    }).join(' ');

    // Calculate Y-axis steps based on min and max
    const ySteps = 4;
    const yStepValues = Array.from({length: ySteps}).map((_, i) => min + (range / (ySteps - 1)) * i);

    return (
      <div className="relative w-full h-[200px] mt-6 flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines & Y-axis labels */}
          {yStepValues.map((yVal, i) => {
            const y = height - padY - ((yVal - min) / range) * (height - 2 * padY);
            return (
              <g key={`grid-${i}`}>
                <line x1={padX} y1={y} x2={width-padRight} y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                <text x={padX - 10} y={y + 3} fontSize="10" textAnchor="end" fill="currentColor" className="text-slate-500 dark:text-slate-400 font-medium">
                  {yVal.toFixed(1)}
                </text>
              </g>
            );
          })}
          
          {/* Line */}
          {values.length > 1 && (
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 drop-shadow-sm" />
          )}
          
          {/* Points & X-axis & Values */}
          {values.map((val, i) => {
            const denom = Math.max(1, values.length - 1);
            const x = padX + (values.length === 1 ? (width - padX - padRight) / 2 : (i / denom) * (width - padX - padRight));
            const y = height - padY - ((val - min) / range) * (height - 2 * padY);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="white" className="dark:fill-slate-900" stroke="currentColor" strokeWidth="2.5" style={{ color: '#10b981' }} />
                <text x={x} y={height} fontSize="10" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400 font-medium">{labels[i]}</text>
                <text x={x} y={y - 12} fontSize="10" textAnchor="middle" fill="currentColor" className="text-slate-700 dark:text-slate-300 font-bold">{val}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl w-full mx-auto space-y-6 font-sans pb-16 relative px-2"
    >
      {/* Toast Notification */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className={`pointer-events-auto select-auto px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2 text-white ${toastMessage.includes('cancel') ? 'bg-rose-500' : 'bg-emerald-500'}`}
            >
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/5 dark:bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="flex gap-4 relative z-10">
          <div>
            <span className="text-[10px] font-black tracking-widest text-blue-500 dark:text-blue-400 uppercase mb-1 block">LAB & DIAGNOSTICS</span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1.5">
              Lab Tests & Diagnostics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Book health checkups, track trends, and view your lab reports
            </p>
          </div>
        </div>
        <button 
          onClick={() => { setTestType(''); setIsBookingModalOpen(true); }}
          className="relative group flex items-center gap-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto justify-center z-10"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Test</span>
        </button>
      </div>

      {/* 2. RESULTS AT A GLANCE & TRENDS & PREP (TOP DASHBOARD) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Results Summary & Trends */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Results Summary */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Your Results at a Glance
              </h2>
              <button 
                onClick={() => { document.getElementById('recent-reports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All Results <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div 
                onClick={() => { setStatusFilter('Normal'); document.getElementById('recent-reports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 p-5 rounded-2xl cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between min-h-[100px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{reports.filter((r) => r.status === 'Normal').length}</span>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Normal</p>
              </div>
              
              <div 
                onClick={() => { setStatusFilter('Borderline'); document.getElementById('recent-reports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-5 rounded-2xl cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between min-h-[100px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl font-black text-amber-700 dark:text-amber-400">{reports.filter((r) => r.status === 'Borderline').length}</span>
                </div>
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Borderline</p>
              </div>

              <div 
                onClick={() => { setStatusFilter('Attention'); document.getElementById('recent-reports-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 p-5 rounded-2xl cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between min-h-[100px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <Zap className="w-5 h-5 text-rose-500 fill-rose-500 group-hover:scale-110 transition-transform" />
                  <span className="text-2xl font-black text-rose-700 dark:text-rose-400">{reports.filter((r) => r.status === 'Attention').length}</span>
                </div>
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wider">Attention</p>
              </div>
            </div>
          </div>

          {/* Health Trends */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Health Trends
                <Info className="w-4 h-4 text-slate-400 ml-1" />
              </h2>
              <div className="relative group">
                <select 
                  value={selectedTrendMetric}
                  onChange={(e) => setSelectedTrendMetric(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium px-4 py-1.5 rounded-lg appearance-none pr-8 cursor-pointer outline-none focus:border-blue-500"
                >
                  <option value="HbA1c">HbA1c</option>
                  <option value="Vitamin D">Vitamin D</option>
                  <option value="Cholesterol">Cholesterol</option>
                  <option value="Hemoglobin">Hemoglobin</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            
            <div className="flex-1">
              {renderTrendChart()}
            </div>
            
            <div className="mt-6 -mx-6 -mb-6 bg-blue-50/50 dark:bg-blue-900/10 border-t border-slate-100 dark:border-slate-800/50 p-4 rounded-b-3xl flex justify-center">
              <button 
                onClick={() => setIsFullTrendsModalOpen(true)}
                className="text-blue-600 dark:text-blue-400 font-bold text-sm underline flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                View Full Trends <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Reminders & Prep */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Upcoming Reminder */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 blur-2xl rounded-full"></div>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-blue-200" />
              <h2 className="text-sm font-black uppercase tracking-wider text-blue-100">Upcoming Test</h2>
            </div>
            
            {upcomingTests[0] ? (
              <>
                <div className="mb-4">
                  <h3 className="text-xl font-black mb-1">{upcomingTests[0].title}</h3>
                  <div className="flex items-center gap-3 text-sm font-medium text-blue-100">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {upcomingTests[0].date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {upcomingTests[0].time}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 group">
                    <select 
                      className="w-full bg-black/20 border border-white/20 text-sm font-bold px-4 py-2.5 rounded-xl appearance-none pr-8 cursor-pointer outline-none focus:border-white text-white placeholder-white/50"
                      onChange={(e) => {
                        setReminderStatus(e.target.value);
                        showToast(`Reminder set for ${e.target.value.toLowerCase()}!`);
                      }}
                      value={reminderStatus || ""}
                    >
                      <option value="" disabled className="text-slate-900">Set Reminder...</option>
                      <option value="1 day before" className="text-slate-900">1 day before</option>
                      <option value="2 days before" className="text-slate-900">2 days before</option>
                      <option value="1 week before" className="text-slate-900">1 week before</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-white/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedUpcomingTest(upcomingTests[0]);
                      setIsRescheduleModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-white text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-50 transition-colors shadow-sm"
                  >
                    Reschedule
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-blue-100">No upcoming lab tests scheduled yet.</p>
                <button
                  onClick={() => { setTestType('Complete Blood Count (CBC)'); setIsBookingModalOpen(true); }}
                  className="px-4 py-2.5 bg-white text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-50 transition-colors shadow-sm"
                >
                  Schedule a Lab Test
                </button>
              </div>
            )}
          </div>

          {/* Before Your Test */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <CheckSquare className="w-5 h-5 text-emerald-500" />
              Before Your Test
            </h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">Checklist for Complete Blood Count:</p>
            
            <div className="space-y-2 mb-4">
              {[
                { key: 'fasting', label: 'Fast for 8–12 hours' },
                { key: 'water', label: 'Drink sufficient water' },
                { key: 'exercise', label: 'Avoid heavy exercise' },
                { key: 'reports', label: 'Bring previous reports' },
                { key: 'id', label: 'Carry your ID/health card' }
              ].map(item => (
                <div 
                  key={item.key} 
                  onClick={() => toggleChecklist(item.key as keyof typeof prepChecklist)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors"
                >
                  {prepChecklist[item.key as keyof typeof prepChecklist] 
                    ? <CheckSquare className="w-5 h-5 text-emerald-500" /> 
                    : <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  }
                  <span className={`text-sm font-medium ${prepChecklist[item.key as keyof typeof prepChecklist] ? 'text-slate-900 dark:text-white line-through opacity-70' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setIsPreparationModalOpen(true)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2"
            >
              <Info className="w-4 h-4" /> View Preparation Guide
            </button>
          </div>

        </div>
      </div>

      {/* 3. SEARCH & FILTER */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch z-20 relative">
        <div className="relative flex-[2] w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search tests or reports..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-3 outline-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
          <div className="relative group shrink-0">
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold px-4 py-3 rounded-xl appearance-none pr-9 cursor-pointer outline-none focus:border-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Normal">Normal</option>
              <option value="Attention">Attention Needed</option>
              <option value="Borderline">Borderline</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative group shrink-0">
            <select 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold px-4 py-3 rounded-xl appearance-none pr-9 cursor-pointer outline-none focus:border-blue-500"
            >
              <option value="All">All Dates</option>
              <option value="2026">2026</option>
              <option value="Aug 15">August</option>
              <option value="Sep">September</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {(searchQuery || statusFilter !== 'All' || dateFilter !== 'All') && (
            <button 
              onClick={() => { setSearchQuery(''); setStatusFilter('All'); setDateFilter('All'); }}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN LISTS (UPCOMING & RECENT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: UPCOMING TESTS */}
        <section id="upcoming-tests-section" className="space-y-4 scroll-mt-24">
          <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 px-1">
            <Activity className="w-5 h-5 text-blue-500" />
            Upcoming Tests
          </h2>
          
          <div className="space-y-4">
            <AnimatePresence>
              {filteredUpcoming.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No tests match the current filters.</p>
                </div>
              ) : (
                filteredUpcoming.map((test) => (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 shrink-0 bg-blue-50 dark:bg-blue-900/10 rounded-2xl flex items-center justify-center text-blue-500 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30">
                          {test.icon === 'activity' ? <Activity className="w-6 h-6" /> : <Microscope className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 dark:text-white text-base mb-1">{test.title}</h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {test.date}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {test.time}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {test.method}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${getTestStatusColor(test.status)}`}>
                        {test.status}
                      </span>
                    </div>

                    {test.fasting && (
                      <div className="inline-flex self-start items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                        <AlertCircle className="w-3 h-3" /> Fasting Required
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setIsPreparationModalOpen(true)}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
                      >
                        View Instructions
                      </button>
                      <button 
                        onClick={() => { setSelectedUpcomingTest(test); setIsRescheduleModalOpen(true); }}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-colors"
                      >
                        Reschedule
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* RIGHT: RECENT REPORTS */}
        <section id="recent-reports-section" className="space-y-4 scroll-mt-24">
          <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 px-1">
            <FileText className="w-5 h-5 text-blue-500" />
            Recent Reports
          </h2>
          
          <div className="space-y-4">
            <AnimatePresence>
              {filteredReports.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center"
                >
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No reports match the current filters.</p>
                </motion.div>
              ) : (
                filteredReports.map((report) => (
                  <motion.div 
                    key={report.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border ${getTestStatusColor(report.status)}`}>
                          <FileCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 dark:text-white text-base mb-1">{report.title}</h3>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span>{report.date}</span>
                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                            <span>{report.dr}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${getTestStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setSelectedReport(report)}
                        className="flex-1 min-w-[100px] py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-colors"
                      >
                        View Report
                      </button>
                      <button 
                        onClick={() => showToast(`Downloading ${report.title}.pdf...`)}
                        className="flex-1 min-w-[120px] py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PDF
                      </button>
                      <button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="w-10 h-8 shrink-0 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-colors flex items-center justify-center"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* 5. FIND A LAB TEST (Catalog) */}
      <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Find a Lab Test
          </h2>
          <button onClick={() => setIsAllTestsModalOpen(true)} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            View All Tests <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {popularTests.map((pt, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-blue-500/50 hover:shadow-md transition-all">
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pt.name}</h3>
                  <span className="font-black text-slate-900 dark:text-white">{pt.price}</span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{pt.desc}</p>
              </div>
              <button 
                onClick={() => { setTestType(pt.name); setIsBookingModalOpen(true); }}
                className="w-full py-2 bg-slate-100 group-hover:bg-blue-600 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" /> Book Test
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* --- MODALS --- */}
      
      {/* 1. REPORT PREVIEW MODAL */}
      <AnimatePresence>
        {selectedReport && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 border border-slate-200 dark:border-slate-800"
            >
              <div className="sticky top-0 z-20 flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Official Lab Report</h2>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Apollo Diagnostics</p>
                  </div>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 sm:p-8 space-y-8">
                {/* Patient Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Patient</p>
                    <p className="font-bold text-slate-900 dark:text-white">{patientDisplay.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Age / Sex</p>
                    <p className="font-bold text-slate-900 dark:text-white">{patientDisplay.ageSex}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Date</p>
                    <p className="font-bold text-slate-900 dark:text-white">{selectedReport.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Laboratory</p>
                    <p className="font-bold text-slate-900 dark:text-white">{selectedReport.dr}</p>
                  </div>
                </div>

                {/* Test Summary */}
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{selectedReport.title}</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                    {selectedReport.status === 'Normal' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedReport.status === 'Normal' 
                        ? "All tested parameters fall within the biological reference intervals. No significant abnormalities detected in this panel."
                        : "Attention is required. One or more tested parameters fall outside the standard biological reference intervals. Please consult your physician."}
                    </p>
                  </div>
                </div>

                {/* Test Results Table */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> Parameter Details
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-bold">
                          <th className="pb-3 pr-4">Test Description</th>
                          <th className="pb-3 px-4">Value</th>
                          <th className="pb-3 px-4">Unit</th>
                          <th className="pb-3 pl-4">Ref. Range</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedReport.resultValue ? (
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 pr-4 font-bold text-slate-900 dark:text-white">{selectedReport.title}</td>
                            <td className="py-4 px-4 font-black text-slate-900 dark:text-white">{selectedReport.resultValue}</td>
                            <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{selectedReport.resultUnit || '—'}</td>
                            <td className="py-4 pl-4 text-slate-500 dark:text-slate-400">{selectedReport.referenceRange || '—'}</td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500 dark:text-slate-400 text-xs">
                              {selectedReport.notes || 'No itemized parameter table stored for this report.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 z-20 p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-md flex flex-col sm:flex-row justify-end gap-3">
                <button onClick={() => setSelectedReport(null)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors w-full sm:w-auto">
                  Close
                </button>
                <button 
                  onClick={() => { showToast("Downloading PDF..."); setSelectedReport(null); }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-md"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. BOOKING MODAL */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBookingModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" /> Book Lab Test
                </h2>
                <button onClick={() => setIsBookingModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleBookTest} className="p-6 space-y-5">
                <div className="space-y-2 relative group">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Test Type</label>
                  <div className="relative">
                    <select value={testType} onChange={(e) => setTestType(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all dark:text-white font-bold appearance-none cursor-pointer">
                      <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                      <option value="Lipid Profile">Lipid Profile</option>
                      <option value="Thyroid Panel">Thyroid Panel</option>
                      <option value="Vitamin D & B12">Vitamin D & B12</option>
                      <option value="Full Body Checkup">Full Body Checkup</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none group-focus-within:text-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                    <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all dark:text-white font-bold" required />
                  </div>
                  <div className="space-y-2 relative group">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time</label>
                    <div className="relative">
                      <select value={testTime} onChange={(e) => setTestTime(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all dark:text-white font-bold appearance-none cursor-pointer">
                        <option value="08:00 AM">08:00 AM</option>
                        <option value="09:30 AM">09:30 AM</option>
                        <option value="11:00 AM">11:00 AM</option>
                        <option value="02:00 PM">02:00 PM</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-focus-within:text-blue-500" />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-md border border-blue-400/50 mt-2">
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. RESCHEDULE MODAL */}
      <AnimatePresence>
        {isRescheduleModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRescheduleModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Reschedule Test</h2>
                <button onClick={() => setIsRescheduleModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleReschedule} className="p-6 space-y-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
                  Select a new date and time for your <span className="font-bold text-slate-900 dark:text-white">{selectedUpcomingTest?.title || 'Complete Blood Count (CBC)'}</span>.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Date</label>
                  <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all dark:text-white font-bold" required />
                </div>
                <div className="space-y-2 relative group">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Time</label>
                  <div className="relative">
                    <select value={testTime} onChange={(e) => setTestTime(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all dark:text-white font-bold appearance-none cursor-pointer">
                      <option value="08:00 AM">08:00 AM</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="01:00 PM">01:00 PM</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-focus-within:text-blue-500" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all mt-4">
                  Confirm New Schedule
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 4. PREPARATION GUIDE MODAL */}
      <AnimatePresence>
        {isPreparationModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPreparationModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-500" /> Preparation Guide
                </h2>
                <button onClick={() => setIsPreparationModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                  <h4 className="font-bold text-blue-700 dark:text-blue-400 text-sm mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> General Guidelines
                  </h4>
                  <ul className="text-sm font-medium text-blue-600/90 dark:text-blue-400/90 space-y-2 list-disc pl-5">
                    <li>Do not eat or drink anything except water for 8-12 hours before the test.</li>
                    <li>Continue taking your regular medications unless advised otherwise by your doctor.</li>
                    <li>Avoid smoking and alcohol consumption for at least 24 hours prior.</li>
                    <li>Wear loose, comfortable clothing with sleeves that can easily be rolled up.</li>
                  </ul>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-800/30">
                  <h4 className="font-bold text-rose-700 dark:text-rose-400 text-sm mb-2">Important Note</h4>
                  <p className="text-sm font-medium text-rose-600/90 dark:text-rose-400/90">
                    If you feel dizzy or lightheaded while fasting, please consume a small amount of water or inform the phlebotomist immediately upon arrival.
                  </p>
                </div>
                <button onClick={() => setIsPreparationModalOpen(false)} className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors">
                  I Understand
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 5. SHARE MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsShareModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-500" /> Share Report
                </h2>
                <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6 text-center">
                  Share this lab report securely with your doctor or family members.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => { showToast("Link copied to clipboard!"); setIsShareModalOpen(false); }} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-200 dark:border-slate-700">
                    <ArrowUpRight className="w-6 h-6 text-slate-700 dark:text-slate-300 mb-2" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Copy Link</span>
                  </button>
                  <button onClick={() => { showToast("Sending via Email..."); setIsShareModalOpen(false); }} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-colors border border-slate-200 dark:border-slate-700">
                    <MapPin className="w-6 h-6 text-slate-700 dark:text-slate-300 mb-2" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Doctor</span>
                  </button>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="w-full text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 6. FULL TRENDS MODAL */}
      <AnimatePresence>
        {isFullTrendsModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFullTrendsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 border border-slate-200 dark:border-slate-800">
              <div className="sticky top-0 z-20 flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" /> Full {selectedTrendMetric} Trends
                </h2>
                <button onClick={() => setIsFullTrendsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                   {renderTrendChart()}
                </div>
                
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">Historical Data</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-bold">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 px-4">Value</th>
                        <th className="pb-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(trendDataMap[selectedTrendMetric]?.labels || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-500 text-xs">
                            No historical readings recorded for {selectedTrendMetric} yet.
                          </td>
                        </tr>
                      ) : (
                        trendDataMap[selectedTrendMetric].labels.map((label, i) => {
                          const val = trendDataMap[selectedTrendMetric].values[i];
                          const normalRange = trendDataMap[selectedTrendMetric].normalRange;
                          const isNormal = val >= normalRange[0] && val <= normalRange[1];
                          return (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 pr-4 font-bold text-slate-900 dark:text-white">{label}</td>
                              <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{val}</td>
                              <td className="py-3 px-4">
                                {isNormal ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                                    <CheckCircle2 className="w-3 h-3" /> Normal
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                                    <AlertCircle className="w-3 h-3" /> Borderline
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 7. ALL TESTS MODAL */}
      <AnimatePresence>
        {isAllTestsModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAllTestsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="sticky top-0 z-20 flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" /> All Lab Tests
                </h2>
                <button onClick={() => setIsAllTestsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {popularTests.map((pt, i) => (
                    <div key={`all-${i}`} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-500/50 hover:shadow-md transition-all">
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pt.name}</h3>
                          <span className="font-black text-slate-900 dark:text-white">{pt.price}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{pt.desc}</p>
                      </div>
                      <button 
                        onClick={() => { setIsAllTestsModalOpen(false); setTestType(pt.name); setIsBookingModalOpen(true); }}
                        className="w-full py-2 bg-slate-100 group-hover:bg-blue-600 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-4 h-4" /> Book Test
                      </button>
                    </div>
                  ))}
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-500/50 hover:shadow-md transition-all">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Liver Function Test (LFT)</h3>
                        <span className="font-black text-slate-900 dark:text-white">$55</span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Liver health</p>
                    </div>
                    <button 
                      onClick={() => { setIsAllTestsModalOpen(false); setTestType("Liver Function Test (LFT)"); setIsBookingModalOpen(true); }}
                      className="w-full py-2 bg-slate-100 group-hover:bg-blue-600 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> Book Test
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-500/50 hover:shadow-md transition-all">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Kidney Panel (KFT)</h3>
                        <span className="font-black text-slate-900 dark:text-white">$65</span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kidney health</p>
                    </div>
                    <button 
                      onClick={() => { setIsAllTestsModalOpen(false); setTestType("Kidney Panel (KFT)"); setIsBookingModalOpen(true); }}
                      className="w-full py-2 bg-slate-100 group-hover:bg-blue-600 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> Book Test
                    </button>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-500/50 hover:shadow-md transition-all">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Urine Routine</h3>
                        <span className="font-black text-slate-900 dark:text-white">$20</span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Urine analysis</p>
                    </div>
                    <button 
                      onClick={() => { setIsAllTestsModalOpen(false); setTestType("Urine Routine"); setIsBookingModalOpen(true); }}
                      className="w-full py-2 bg-slate-100 group-hover:bg-blue-600 dark:bg-slate-700 text-slate-700 dark:text-slate-300 group-hover:text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> Book Test
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
