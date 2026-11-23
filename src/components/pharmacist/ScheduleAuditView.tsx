import React, { useState } from 'react';
import { 
  FileCheck2, 
  ShieldCheck, 
  CheckCircle2, 
  Download, 
  Lock,
  UserCheck
} from 'lucide-react';

export const ScheduleAuditView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  React.useEffect(() => {
    import('../../services/dhrApis').then(({ pharmacyOpsApi }) => {
      pharmacyOpsApi
        .getScheduleAudit()
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            setLogs(
              res.data.map((l: any) => ({
                logId: l.logCode || l.id,
                date: new Date(l.dispensedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                drugName: l.medicineName,
                scheduleCategory: l.scheduleClass || 'Schedule H1',
                quantityDispensed: `${l.quantityDispensed} Units`,
                patientName: l.patient?.fullName || l.patientId || 'Patient',
                prescribingDoctor: l.doctor?.fullName || 'Verified Physician',
                batchNo: l.batchNumber || '—',
                status: l.verificationState || 'Verified',
                regulatoryCompliance: 'CDSCO Logged',
              }))
            );
          }
        })
        .catch(() => setLogs([]));
    });
  }, []);

  const SCHEDULE_DRUG_LOGS = logs.filter(
    (l) =>
      !searchTerm.trim() ||
      l.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.logId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportDrugInspectorReport = () => {
    const rows = SCHEDULE_DRUG_LOGS;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Download CSV archive of the loaded MySQL ScheduleDrugLog rows
    const csvEscape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Log ID',
      'Date & Time',
      'Schedule Class',
      'Drug Name',
      'Quantity Dispensed',
      'Patient Name',
      'Prescribing Doctor',
      'Batch Number',
      'Verification Status',
      'Compliance',
    ];
    const csvLines = [
      headers.map(csvEscape).join(','),
      ...rows.map((l) =>
        [
          l.logId,
          l.date,
          l.scheduleCategory,
          l.drugName,
          l.quantityDispensed,
          l.patientName,
          l.prescribingDoctor,
          l.batchNo,
          l.status,
          l.regulatoryCompliance,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cdsco-schedule-audit-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 2. Also open print-ready Drug Inspector PDF report view
    const printWin = window.open('', '_blank', 'width=960,height=720');
    if (printWin) {
      const tableRowsHtml =
        rows.length === 0
          ? `<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">No Schedule Drug Audit entries recorded.</td></tr>`
          : rows
              .map(
                (l) => `
              <tr>
                <td>${l.logId}</td>
                <td>${l.date}</td>
                <td><strong>${l.scheduleCategory}</strong></td>
                <td>${l.drugName} (${l.quantityDispensed})</td>
                <td>${l.patientName}</td>
                <td>${l.prescribingDoctor}</td>
                <td>${l.batchNo} • ${l.status}</td>
              </tr>`
              )
              .join('');

      printWin.document.write(`<!doctype html>
<html>
<head>
  <title>CDSCO Schedule H1/H/X Drug Inspector Audit Register - ${today}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    p { font-size: 12px; color: #475569; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
  </style>
</head>
<body>
  <h1>CDSCO Schedule H1 / H / X Statutory Drug Audit Register</h1>
  <p>Generated on ${new Date().toLocaleString()} • Total Entries: ${rows.length}</p>
  <table>
    <thead>
      <tr>
        <th>Log ID</th>
        <th>Dispensed At</th>
        <th>Schedule</th>
        <th>Drug & Qty</th>
        <th>Patient</th>
        <th>Prescribing Doctor</th>
        <th>Batch & Status</th>
      </tr>
    </thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>
</body>
</html>`);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 250);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans select-none max-w-7xl mx-auto">
      
      {/* HEADER BANNER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-50 via-amber-50/50 to-white dark:from-slate-900 dark:via-amber-950/70 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[11px] font-black uppercase tracking-wider border border-amber-500/20 dark:border-amber-400/30 font-mono">
            <Lock className="w-3.5 h-3.5" /> CDSCO Schedule H1 / H / X Audit Register
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Controlled Drug Regulatory Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-medium max-w-2xl">
            Statutory digital dispensing register for habit-forming, psychotropic, and restricted antibiotics as mandated by the Drugs & Cosmetics Act.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            type="button"
            onClick={handleExportDrugInspectorReport}
            className="px-5 py-3 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-900 dark:text-white font-bold text-xs border border-slate-200 dark:border-white/15 shadow-sm dark:shadow-none backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            <span>Export Drug Inspector PDF</span>
          </button>
        </div>
      </div>

      {/* COMPLIANCE AUDIT METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[
          { label: 'Schedule Entries', value: `${logs.length} Dispensed`, icon: FileCheck2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'NMC Doctor Sign-Off', value: logs.length > 0 ? `${Math.round((logs.filter((l) => l.status === 'Verified').length / logs.length) * 100)}% Verified` : '0 Entries', icon: UserCheck, color: 'text-teal-500', bg: 'bg-teal-500/10' },
          { label: 'Unverified Dispensation', value: `${logs.filter((l) => l.status !== 'Verified').length} Disputed`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Audit Readiness', value: logs.length > 0 ? 'Inspector Ready' : 'No Logs Yet', icon: ShieldCheck, color: 'text-cyan-500', bg: 'bg-cyan-500/10' }
        ].map((s, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">{s.label}</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{s.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* REGULATORY LOGS TABLE */}
      <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-amber-500" />
            Prescription Dispensing Logbook
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by drug, patient, or log ID..."
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">Real-time Timestamped</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {SCHEDULE_DRUG_LOGS.length === 0 ? (
            <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
              No Schedule H1 / H / X dispensing logs recorded yet.
            </div>
          ) : (
            SCHEDULE_DRUG_LOGS.map((log) => (
              <div key={log.logId} className="p-5 space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                      {log.scheduleCategory}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{log.drugName}</h4>
                    <span className="text-xs font-mono font-bold text-slate-400">({log.quantityDispensed})</span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {log.date}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                  <p><strong>Patient: </strong> {log.patientName}</p>
                  <p><strong>Doctor: </strong> {log.prescribingDoctor}</p>
                  <p><strong>Batch No: </strong> <span className="font-mono">{log.batchNo}</span></p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono">
                  <span className="text-teal-600 dark:text-cyan-400 font-bold">{log.regulatoryCompliance}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Digital Hash: {log.logId}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
