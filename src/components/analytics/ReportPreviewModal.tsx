import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Printer, CheckCircle2 } from 'lucide-react';
import {
  profileApi,
  vitalApi,
  medicineApi,
  appointmentApi,
  recordApi,
} from '../../services/dhrApis';

export interface AnalyticsReportData {
  patientName?: string;
  abhaId?: string;
  healthScore: number;
  adherencePct: number;
  totalAppointments: number;
  videoConsultations: number;
  totalRecords: number;
  vitals: any[];
  doseHistory?: any[];
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: string;
  reportData?: AnalyticsReportData;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  dateRange,
  reportData,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadedMsg, setDownloadedMsg] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<AnalyticsReportData>({
    patientName: reportData?.patientName || 'Patient',
    abhaId: reportData?.abhaId || 'Not Linked',
    healthScore: reportData?.healthScore ?? 0,
    adherencePct: reportData?.adherencePct ?? 0,
    totalAppointments: reportData?.totalAppointments ?? 0,
    videoConsultations: reportData?.videoConsultations ?? 0,
    totalRecords: reportData?.totalRecords ?? 0,
    vitals: reportData?.vitals || [],
    doseHistory: reportData?.doseHistory || [],
  });

  useEffect(() => {
    if (!isOpen) return;
    if (reportData) {
      setLiveData(reportData);
      return;
    }

    let mounted = true;
    Promise.all([
      profileApi.getPatientProfile().catch(() => ({ data: null })),
      vitalApi.getVitals().catch(() => ({ data: [] })),
      medicineApi.getAdherenceTrends().catch(() => ({ data: { summary: null, timeSeries: [], hasData: false } })),
      appointmentApi.getAppointments().catch(() => ({ data: [] })),
      recordApi.getMedicalRecords().catch(() => ({ data: [] })),
    ]).then(([profRes, vitRes, adhRes, aptRes, recRes]) => {
      if (!mounted) return;
      const p = profRes?.data;
      const vitals = Array.isArray(vitRes?.data) ? vitRes.data : [];
      const apts = Array.isArray(aptRes?.data) ? aptRes.data : [];
      const recs = Array.isArray(recRes?.data) ? recRes.data : [];
      const adhPct = adhRes?.data?.hasData
        ? Math.round(Number(adhRes.data.summary?.overallAdherence ?? adhRes.data.summary?.adherenceRate ?? 0))
        : 0;

      const latest = vitals[0];
      const parts: number[] = [];
      if (latest?.heartRate != null) parts.push(latest.heartRate >= 60 && latest.heartRate <= 100 ? 94 : 76);
      if (latest?.oxygenSaturation != null) parts.push(latest.oxygenSaturation >= 95 ? 96 : 78);
      if (adhRes?.data?.hasData) parts.push(adhPct);
      const score = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

      setLiveData({
        patientName: p?.fullName || 'Patient',
        abhaId: p?.user?.abhaId || p?.abhaId || 'Not Linked',
        healthScore: score,
        adherencePct: adhPct,
        totalAppointments: apts.length,
        videoConsultations: apts.filter((a: any) => a.type === 'VIDEO').length,
        totalRecords: recs.length,
        vitals,
      });
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, reportData]);

  if (!isOpen) return null;

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleDownloadCSV = () => {
    setDownloading(true);
    try {
      const escapeCsv = (val: unknown) => {
        const str = String(val ?? '');
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const rows: string[][] = [
        ['Health Analytics Report'],
        ['Patient Name', liveData.patientName || 'Patient'],
        ['ABHA ID', liveData.abhaId || 'Not Linked'],
        ['Timeframe', dateRange],
        ['Generated On', generatedDate],
        ['Health Score', `${liveData.healthScore}/100`],
        ['Medication Adherence (%)', `${liveData.adherencePct}%`],
        ['Total Appointments', String(liveData.totalAppointments)],
        ['Video Consultations', String(liveData.videoConsultations)],
        ['Medical Records Synced', String(liveData.totalRecords)],
        [],
        ['Recorded At', 'Heart Rate (BPM)', 'Systolic BP', 'Diastolic BP', 'SpO2 (%)', 'Temperature', 'Blood Sugar', 'Weight (kg)', 'Notes'],
      ];

      (liveData.vitals || []).forEach((v: any) => {
        rows.push([
          v.recordedAt ? new Date(v.recordedAt).toISOString() : '',
          v.heartRate ?? '',
          v.systolicBp ?? '',
          v.diastolicBp ?? '',
          v.oxygenSaturation ?? '',
          v.temperature ?? '',
          v.bloodSugar ?? '',
          v.weightKg ?? '',
          v.notes ?? '',
        ]);
      });

      const csvContent = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `health-analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadedMsg('✓ Health Analytics CSV exported with live database records');
      setTimeout(() => setDownloadedMsg(null), 3500);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.print();
    setDownloadedMsg('✓ Opened print / Save as PDF dialog with live report data');
    setTimeout(() => setDownloadedMsg(null), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 font-sans print:p-0 print:bg-white print:text-black">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto text-slate-900 dark:text-white print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white print:p-0">
        {/* HEADER (HIDE ON PRINT) */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-[#00a896] dark:text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00a896] dark:text-cyan-400 font-mono">
                Generated Report • {dateRange}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Personal Health Activity Report</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOAST NOTIFICATION FOR DOWNLOAD */}
        {downloadedMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 font-sans print:hidden">
            <CheckCircle2 className="w-4 h-4" />
            <span>{downloadedMsg}</span>
          </div>
        )}

        {/* REPORT CONTENT BODY */}
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono space-y-2">
            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-sans">Patient Name:</span><strong className="text-slate-900 dark:text-white font-sans">{liveData.patientName || 'Patient'}</strong></div>
            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-sans">ABHA ID:</span><strong className="text-[#00a896] dark:text-cyan-300">{liveData.abhaId || 'Not Linked'}</strong></div>
            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-sans">Timeframe:</span><strong className="text-slate-900 dark:text-white">{dateRange}</strong></div>
            <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400 font-sans">Generated On:</span><strong className="text-slate-900 dark:text-white">{generatedDate}</strong></div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-mono">Summary Highlights</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed font-medium">
              <li>Overall Health Score: {liveData.healthScore > 0 ? `${liveData.healthScore} / 100` : 'No vitals recorded yet'}</li>
              <li>Medication Adherence: {liveData.adherencePct}% completion rate</li>
              <li>Appointments Recorded: {liveData.totalAppointments} total ({liveData.videoConsultations} video tele-consultations)</li>
              <li>Medical Records Synced: {liveData.totalRecords} document{liveData.totalRecords === 1 ? '' : 's'} in vault</li>
              <li>Vital Readings Logged: {liveData.vitals.length} recorded reading{liveData.vitals.length === 1 ? '' : 's'}</li>
            </ul>
          </div>
        </div>

        {/* FOOTER ACTIONS (HIDE ON PRINT) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3 print:hidden font-sans">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Print Report</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={downloading}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#00a896] dark:text-cyan-300 font-bold text-xs border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-5 py-2.5 rounded-xl bg-[#00a896] hover:bg-[#00897b] text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Exporting...' : 'Print / Save PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
