import React, { useState, useEffect, useRef } from 'react';
import { patientExtendedApi, recordApi, uploadApi, profileApi } from '../../../services/dhrApis';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, AlertCircle, FileText, UploadCloud, Search,
  CheckCircle2, AlertTriangle, FileBox, HeartPulse, Stethoscope,
  Droplets, Microscope, MessageSquare, Download, ZoomIn,
  ZoomOut, Maximize2, Calendar, ArrowUpRight, ArrowDownRight,
  ShieldCheck, FileSearch, Sparkles
} from 'lucide-react';

export function ReportInsightsView() {
  type TabType = 'overview' | 'reports' | 'insights' | 'ai';
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Reports');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real Upload States
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState(0);

  // Real DB Data
  const [patientInfo, setPatientInfo] = useState({
    name: 'Patient',
    id: 'Not Recorded',
    bloodGroup: 'Not Recorded',
  });
  const [dbInsights, setDbInsights] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [zoom, setZoom] = useState(100);

  // Clinical Review Notes state
  const [reviewNotes, setReviewNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState('No');
  const [reviewPriority, setReviewPriority] = useState('Normal');
  const [savingReview, setSavingReview] = useState(false);

  // AI Tab chat state
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ id: string; sender: 'ai' | 'user'; text: string }>>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    try {
      const [insightsRes, recordsRes, profRes] = await Promise.all([
        patientExtendedApi.getReportInsights().catch(() => null),
        recordApi.getMedicalRecords().catch(() => null),
        profileApi.getPatientProfile().catch(() => null),
      ]);

      const pat: any = profRes?.data;
      if (pat) {
        setPatientInfo({
          name: pat.fullName || 'Patient',
          id: pat.abhaId || pat.id?.slice(-8)?.toUpperCase() || 'Not Recorded',
          bloodGroup: pat.bloodGroup || 'Not Recorded',
        });
      }

      const loadedInsights = Array.isArray(insightsRes?.data) ? insightsRes!.data : [];
      setDbInsights(loadedInsights);

      const loadedRecords = Array.isArray(recordsRes?.data) ? recordsRes!.data : [];
      setRecords(loadedRecords);
      if (loadedRecords.length > 0 && !selectedRecord) {
        setSelectedRecord(loadedRecords[0]);
      }
    } catch {
      setDbInsights([]);
      setRecords([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewInsight = async (id: string, status: 'accepted' | 'dismissed' | 'pending') => {
    setDbInsights((prev) => prev.map((it) => (it.id === id ? { ...it, reviewStatus: status } : it)));
    try {
      await patientExtendedApi.updateReportInsight(id, { reviewStatus: status });
      showToast(`✓ Insight marked as ${status} in database`);
    } catch {
      showToast('Failed to update insight status');
      await loadData();
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(20);
    setUploadStep(1);
    try {
      const upRes = await uploadApi.uploadImage(file, 'MEDICAL_REPORT');
      setUploadProgress(50);
      setUploadStep(2);

      const fileUrl = upRes?.data?.url || undefined;
      const originalName = upRes?.data?.originalName || file.name;
      const title = originalName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

      const recRes = await recordApi.createMedicalRecord({
        title,
        type: 'LAB_REPORT',
        hospital: 'Uploaded Diagnostic Report',
        fileUrl,
        fileName: originalName,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        status: 'Pending Review',
        notes: 'Uploaded via Report Insights & AI',
      });
      setUploadProgress(80);
      setUploadStep(3);

      const createdRecord = recRes?.data;
      await patientExtendedApi.createReportInsight({
        medicalRecordId: createdRecord?.id || undefined,
        title: `Analysis: ${title}`,
        category: 'Lab Report',
        summary: `Uploaded "${originalName}" for ${patientInfo.name}. Ready for clinical review and value verification.`,
        priority: 'Normal',
      });

      setUploadProgress(100);
      setUploadStep(4);
      await loadData();
      if (createdRecord) setSelectedRecord(createdRecord);
      showToast(`✓ Uploaded "${originalName}" and created insight in database`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload medical report');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadStep(0);
        setUploadProgress(0);
      }, 800);
    }
  };

  const handleSaveClinicalReview = async () => {
    if (!reviewNotes.trim()) {
      showToast('Please enter clinical review notes before saving');
      return;
    }
    setSavingReview(true);
    try {
      const targetInsight = dbInsights.find((i) => selectedRecord && i.medicalRecordId === selectedRecord.id) || dbInsights[0];
      const formattedNote = `${reviewNotes.trim()} (Follow-up: ${followUpRequired}, Priority: ${reviewPriority})`;
      if (targetInsight) {
        await patientExtendedApi.updateReportInsight(targetInsight.id, {
          reviewStatus: 'accepted',
          summary: formattedNote,
        });
      } else {
        await patientExtendedApi.createReportInsight({
          medicalRecordId: selectedRecord?.id || undefined,
          title: selectedRecord ? `Clinical Review: ${selectedRecord.title}` : 'Clinical Report Review',
          category: selectedRecord?.type || 'General',
          summary: formattedNote,
          priority: reviewPriority,
        });
      }
      setReviewNotes('');
      await loadData();
      showToast('✓ Clinical review saved to database');
    } catch {
      showToast('Failed to save clinical review');
    } finally {
      setSavingReview(false);
    }
  };

  const handleAskAi = (promptText?: string) => {
    const query = (promptText ?? aiInput).trim();
    if (!query) return;
    const userMsg = { id: `u-${Date.now()}`, sender: 'user' as const, text: query };

    const activeRec = selectedRecord || records[0];
    let reply = '';
    if (!activeRec && dbInsights.length === 0) {
      reply = `No medical reports are currently uploaded for ${patientInfo.name}. Upload a report in the Reports tab to analyze findings.`;
    } else {
      const insightSummary = dbInsights.length > 0
        ? dbInsights.slice(0, 3).map((i, idx) => `${idx + 1}. ${i.title}: ${i.summary}`).join(' ')
        : 'No structured insights recorded yet.';
      reply = `Based on ${records.length} stored report(s) for ${patientInfo.name}${activeRec ? ` (latest: "${activeRec.title}")` : ''}: ${insightSummary} Please consult your physician for clinical decisions.`;
    }

    const aiMsg = { id: `a-${Date.now() + 1}`, sender: 'ai' as const, text: reply };
    setAiMessages((prev) => [...prev, userMsg, aiMsg]);
    setAiInput('');
  };

  // Computed metrics from real DB data
  const withinRangeCount = dbInsights.filter((i) => i.reviewStatus === 'accepted' || String(i.priority || '').toLowerCase() === 'normal').length;
  const needsReviewCount = dbInsights.filter((i) => i.reviewStatus === 'pending').length;
  const criticalCount = dbInsights.filter((i) => String(i.priority || '').toLowerCase() === 'high' || String(i.priority || '').toLowerCase() === 'critical').length;

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      String(r.title || '').toLowerCase().includes(q) ||
      String(r.type || '').toLowerCase().includes(q) ||
      String(r.hospital || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (categoryFilter === 'All Reports') return true;
    const t = String(r.type || '').toUpperCase();
    if (categoryFilter === 'Blood') return t.includes('LAB') || String(r.title || '').toLowerCase().includes('blood');
    if (categoryFilter === 'Imaging') return t.includes('IMAGING');
    if (categoryFilter === 'Cardiology') return String(r.title || '').toLowerCase().includes('ecg') || String(r.title || '').toLowerCase().includes('cardio');
    return true;
  });

  const latestRecord = records[0] || null;
  const activeInspectRecord = selectedRecord || latestRecord;

  const countByType = (matcher: (r: any) => boolean) => records.filter(matcher).length;

  // --- RENDERERS ---

  const renderOverviewTab = () => (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Categories */}
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {[
          { label: 'Lab Reports', count: countByType((r) => String(r.type || '').toUpperCase() === 'LAB_REPORT'), icon: Droplets, color: 'text-rose-500' },
          { label: 'Prescriptions', count: countByType((r) => String(r.type || '').toUpperCase() === 'PRESCRIPTION'), icon: Microscope, color: 'text-purple-500' },
          { label: 'Consultations', count: countByType((r) => String(r.type || '').toUpperCase() === 'CONSULTATION'), icon: HeartPulse, color: 'text-indigo-500' },
          { label: 'Imaging', count: countByType((r) => String(r.type || '').toUpperCase() === 'IMAGING'), icon: FileBox, color: 'text-emerald-500' },
          { label: 'Other Records', count: countByType((r) => !['LAB_REPORT', 'PRESCRIPTION', 'CONSULTATION', 'IMAGING'].includes(String(r.type || '').toUpperCase())), icon: Stethoscope, color: 'text-amber-500' },
        ].map(cat => (
          <div key={cat.label} onClick={() => setActiveTab('reports')} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-w-[180px] shrink-0 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${cat.color}`}>
              <cat.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cat.label}</h3>
              <p className="text-xs text-slate-500 font-medium">{cat.count} {cat.count === 1 ? 'Report' : 'Reports'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Latest Report & AI Summary */}
        <div className="xl:col-span-2 space-y-6">

          {/* AI SUMMARY HERO */}
          <div className="bg-white dark:bg-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-cyan-500 dark:text-cyan-400" /> AI Report Summary
              </h2>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 mb-8 border border-slate-200 dark:border-slate-700/50">
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {dbInsights.length > 0
                    ? dbInsights[0].summary
                    : records.length > 0
                    ? `${records.length} medical report(s) stored for ${patientInfo.name}. Upload a new report or save a review to generate structured insights.`
                    : `No medical reports or AI insights recorded yet for ${patientInfo.name}. Upload a report in the Reports tab to get started.`}
                </p>
                <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-cyan-600 dark:text-cyan-500">
                  <ShieldCheck className="w-3 h-3" /> Database-synced analysis
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4">
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">{withinRangeCount}</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Reviewed / Normal</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1">{needsReviewCount}</div>
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Needs Review</div>
                </div>
                <div className="bg-slate-50 dark:bg-rose-900/20 border border-slate-200 dark:border-rose-800/30 rounded-2xl p-4">
                  <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mb-1">{criticalCount}</div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">High Priority</div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-500" /> Key Insights ({dbInsights.length})
            </h3>
            {dbInsights.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No report insights yet</p>
                <p className="text-xs text-slate-500">Upload a medical report in the Reports tab to generate and track insights.</p>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl"
                >
                  Upload Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {dbInsights.map((insight) => {
                  const status = insight.reviewStatus || 'pending';
                  return (
                    <div key={insight.id} className={`p-5 rounded-2xl border transition-colors ${status === 'accepted' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' : status === 'dismissed' ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{insight.title}</h4>
                            {insight.category && (
                              <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">{insight.category}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{insight.summary}</p>

                          {status === 'accepted' && (
                            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Accepted & Reviewed
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {status === 'pending' ? (
                            <>
                              <button onClick={() => handleReviewInsight(insight.id, 'dismissed')} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Dismiss</button>
                              <button onClick={() => handleReviewInsight(insight.id, 'accepted')} className="px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 text-xs font-bold rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors">Accept</button>
                            </>
                          ) : (
                            <button onClick={() => handleReviewInsight(insight.id, 'pending')} className="px-4 py-2 text-slate-500 text-xs font-bold hover:underline">Undo</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Column */}
        <div className="space-y-6">

          {/* Latest Report Detail */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl"></div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Latest Stored Report</div>
            {latestRecord ? (
              <>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">{latestRecord.title}</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Date</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {latestRecord.recordDate ? new Date(latestRecord.recordDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Status</span>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded-lg">{latestRecord.status || 'Stored'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Facility</span>
                    <span className="text-slate-900 dark:text-white font-bold text-right">{latestRecord.hospital || 'Not Recorded'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Type</span>
                    <span className="text-slate-900 dark:text-white font-bold">{latestRecord.type || 'Medical Record'}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedRecord(latestRecord);
                      setActiveTab('insights');
                    }}
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    View Report
                  </button>
                  {latestRecord.fileUrl && (
                    <a
                      href={latestRecord.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex items-center"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                <p>No medical reports uploaded yet.</p>
                <button onClick={() => setActiveTab('reports')} className="px-4 py-2 bg-cyan-600 text-white rounded-xl font-bold">
                  Upload First Report
                </button>
              </div>
            )}
          </div>

          {/* Pending Insights Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Insights Needing Review
            </h3>
            {dbInsights.filter((i) => (i.reviewStatus || 'pending') === 'pending').length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No pending items needing review.</p>
            ) : (
              <div className="space-y-3">
                {dbInsights
                  .filter((i) => (i.reviewStatus || 'pending') === 'pending')
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{item.category || 'General'}</div>
                      </div>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-500 shrink-0">{item.priority || 'Pending'}</span>
                    </div>
                  ))}
              </div>
            )}
            <button onClick={() => setActiveTab('insights')} className="w-full mt-4 py-2 text-sm font-bold text-cyan-600 hover:underline">View Details in Insights Tab</button>
          </div>

        </div>
      </div>
    </div>
  );

  const renderInsightsTab = () => {
    const parsedMetrics: Array<{ test: string; result: string; range?: string; prev?: string; trend?: string }> = [];
    const matchingInsight = dbInsights.find((i) => activeInspectRecord && i.medicalRecordId === activeInspectRecord.id) || dbInsights[0];
    if (matchingInsight?.metricsJson) {
      try {
        const parsed = JSON.parse(matchingInsight.metricsJson);
        if (Array.isArray(parsed)) parsedMetrics.push(...parsed);
      } catch {}
    }

    return (
      <div className="h-[80vh] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">

        {/* Left Panel: Original Report Viewer */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-800/50 rounded-3xl border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col shadow-inner relative">
          {/* Toolbar */}
          <div className="h-14 bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{activeInspectRecord?.fileName || activeInspectRecord?.title || 'No Report Selected'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom((z) => Math.max(60, z - 10))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs font-bold text-slate-500 w-12 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500"><ZoomIn className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
              <button onClick={() => setZoom(100)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500"><Maximize2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Document Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 flex justify-center">
            {!activeInspectRecord ? (
              <div className="m-auto text-center space-y-3 text-slate-500">
                <FileText className="w-12 h-12 mx-auto opacity-40" />
                <p className="font-bold">No medical reports found in database.</p>
                <button onClick={() => setActiveTab('reports')} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold">
                  Upload Report
                </button>
              </div>
            ) : activeInspectRecord.fileUrl && !activeInspectRecord.fileUrl.endsWith('.pdf') ? (
              <img
                src={activeInspectRecord.fileUrl}
                alt={activeInspectRecord.title}
                style={{ width: `${zoom}%` }}
                className="max-w-2xl object-contain rounded-xl shadow-lg bg-white"
              />
            ) : (
              <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }} className="bg-white w-full max-w-2xl min-h-[500px] shadow-lg border border-slate-300 p-8 sm:p-10 text-slate-800 rounded-xl">
                <div className="border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-end gap-4">
                  <div>
                    <h1 className="text-2xl font-black mb-1 text-slate-900">{activeInspectRecord.hospital || 'Medical Report'}</h1>
                    <p className="text-sm font-medium text-slate-500">{activeInspectRecord.title}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500 space-y-1 shrink-0">
                    <p>Date: {activeInspectRecord.recordDate ? new Date(activeInspectRecord.recordDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    <p>Patient: {patientInfo.name}</p>
                    <p>ID: {patientInfo.id}</p>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-1">Record Type & Status</p>
                    <p className="font-bold text-slate-900">{activeInspectRecord.type} · {activeInspectRecord.status || 'Stored'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-1">Clinical Notes</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{activeInspectRecord.notes || 'No notes recorded for this document.'}</p>
                  </div>
                  {activeInspectRecord.fileUrl && (
                    <a
                      href={activeInspectRecord.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold"
                    >
                      <Download className="w-4 h-4" /> Open Original File
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: AI Insights & Workspace */}
        <div className="w-full lg:w-[500px] xl:w-[600px] flex flex-col gap-6 shrink-0 overflow-y-auto custom-scrollbar pr-2">

          {/* Critical Findings */}
          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-3xl p-6 border border-rose-200 dark:border-rose-900/50">
            <h3 className="text-sm font-black text-rose-700 dark:text-rose-400 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Critical Findings
            </h3>
            <div className="text-sm font-bold text-rose-800 dark:text-rose-300 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl">
              {criticalCount > 0
                ? `${criticalCount} high-priority insight(s) flagged for review.`
                : 'No critical findings identified in stored reports.'}
            </div>
          </div>

          {/* Values Needing Review */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Extracted Metrics & Values
            </h3>

            {parsedMetrics.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No structured lab values recorded for this report yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="pb-3 pr-4">Test</th>
                      <th className="pb-3 px-4">Result</th>
                      <th className="pb-3 px-4">Ref Range</th>
                      <th className="pb-3 px-4">Prev</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {parsedMetrics.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="py-4 pr-4 font-bold text-slate-900 dark:text-white">{m.test}</td>
                        <td className="py-4 px-4 text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1">
                          {m.result}
                          {m.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : m.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : null}
                        </td>
                        <td className="py-4 px-4 text-slate-500">{m.range || '—'}</td>
                        <td className="py-4 px-4 text-slate-500">{m.prev || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Clinical Review Notes */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" /> Clinical Review
            </h3>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white rounded-2xl p-4 outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none h-32 mb-4"
              placeholder="Add your clinical interpretation or follow-up notes..."
            />
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Follow-up Required</label>
                <select
                  value={followUpRequired}
                  onChange={(e) => setFollowUpRequired(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Priority</label>
                <select
                  value={reviewPriority}
                  onChange={(e) => setReviewPriority(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="Normal">Low / Normal</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSaveClinicalReview}
              disabled={savingReview}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-xl transition-colors shadow-md disabled:opacity-60"
            >
              {savingReview ? 'Saving Review...' : 'Save Review'}
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderReportsTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Upload Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6">Upload New Report</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = '';
          }}
        />

        {!isUploading && uploadStep === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
          >
            <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Upload Medical Report</h3>
            <p className="text-sm font-medium text-slate-500 mb-6">Click to select a file (PDF, JPG, PNG) to upload and save to database</p>
            <button type="button" className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-sm">Browse Files</button>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800/80">
              <motion.div
                className="h-full bg-cyan-50 dark:bg-cyan-900/10"
                animate={{ width: `${uploadProgress}%` }}
                transition={{ ease: "linear", duration: 0.4 }}
              />
            </div>

            <div className="relative z-10 space-y-6 max-w-md mx-auto py-4">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${uploadStep >= 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className={`font-bold ${uploadStep >= 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Uploading File</div>
              </div>
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 ml-4 -my-4"></div>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${uploadStep >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className={`font-bold ${uploadStep >= 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Saving Medical Record</div>
              </div>
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 ml-4 -my-4"></div>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${uploadStep >= 3 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className={`font-bold ${uploadStep >= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Recording Report Insight</div>
              </div>
              <div className="w-0.5 h-6 bg-slate-200 dark:bg-slate-700 ml-4 -my-4"></div>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${uploadStep >= 4 ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {uploadStep === 4 ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 bg-current rounded-full animate-pulse" />}
                </div>
                <div className={`font-bold ${uploadStep >= 4 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {uploadStep === 4 ? 'Saved to Database' : 'Finalizing...'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-500" /> Report History ({filteredRecords.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {['All Reports', 'Blood', 'Imaging', 'Cardiology'].map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${categoryFilter === f ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 font-medium">
            No medical reports found. Upload a report above to populate your report history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-4 px-6">Report Name</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Insights</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {filteredRecords.map((r) => {
                  const hasInsight = dbInsights.some((ins) => ins.medicalRecordId === r.id);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">{r.title}</td>
                      <td className="py-4 px-6 text-slate-500">{r.type || 'Medical Record'}</td>
                      <td className="py-4 px-6 text-slate-500">
                        {r.recordDate ? new Date(r.recordDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${String(r.status || '').toLowerCase().includes('normal') || String(r.status || '').toLowerCase().includes('review') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {r.status || 'Stored'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-xs font-bold flex items-center gap-2 pt-5">
                        <Sparkles className={`w-3.5 h-3.5 ${hasInsight ? 'text-cyan-500' : 'text-slate-400'}`} />
                        {hasInsight ? 'Available' : 'Ready'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedRecord(r);
                            setActiveTab('insights');
                          }}
                          className="text-cyan-600 font-bold hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderAITab = () => (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-[70vh] flex flex-col overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
        <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center text-cyan-600 dark:text-cyan-400">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-black text-slate-900 dark:text-white">Ask AI About Your Reports</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verify against your stored medical records</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50 dark:bg-slate-950/30">
        <div className="flex gap-4 max-w-3xl">
          <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center shrink-0 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300">
            Hello {patientInfo.name}. {records.length > 0 ? `You have ${records.length} medical report(s) and ${dbInsights.length} insight(s) on file. What would you like to review?` : 'Upload a medical report in the Reports tab to get started with report analysis.'}
          </div>
        </div>
        {aiMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`p-4 rounded-2xl border shadow-sm text-sm font-medium ${msg.sender === 'user' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap gap-2 mb-4">
          {['Summarize my latest report', 'List pending insights', 'What should I review with my doctor?'].map(q => (
            <button
              key={q}
              onClick={() => handleAskAi(q)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors border border-slate-200 dark:border-slate-700"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAi();
          }}
          className="relative"
        >
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask something about your stored reports..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-6 pr-14 py-4 outline-none text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 text-slate-900 dark:text-white"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm">
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1c] text-slate-900 dark:text-slate-200 pb-32">
      {/* TOAST */}
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

      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* 1. HEADER */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 tracking-wide uppercase">
              <span>Health Records</span> <ChevronRight className="w-3 h-3" />
              <span>{patientInfo.name}</span> <ChevronRight className="w-3 h-3" />
              <span className="text-cyan-600 dark:text-cyan-400">Insights & AI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <FileSearch className="w-7 h-7 text-cyan-500" /> Report Insights & AI
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Analyze stored medical reports, review clinical findings, and track insights from your database records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 outline-none text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 w-48 sm:w-64"
              />
            </div>
            <button onClick={() => setActiveTab('reports')} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
              <UploadCloud className="w-4 h-4" /> Upload Report
            </button>
            <button onClick={() => setActiveTab('reports')} className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md">
              <Calendar className="w-4 h-4" /> View History
            </button>
          </div>
        </div>

        {/* 3. MAIN NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'reports', label: 'Reports' },
            { id: 'insights', label: 'Insights & Trends' },
            { id: 'ai', label: 'AI Assistant' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-6 py-4 text-sm font-black tracking-wide uppercase whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 4. TAB CONTENT RENDERER */}
        <div className="py-2">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'reports' && renderReportsTab()}
          {activeTab === 'insights' && renderInsightsTab()}
          {activeTab === 'ai' && renderAITab()}
        </div>

      </div>
    </div>
  );
}
