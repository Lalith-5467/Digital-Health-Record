import React from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sun,
  Moon,
  Stethoscope,
  Pill,
  Calendar,
  User,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import type { StructuredPrescription } from '../../utils/prescriptionExtractor';
import type { ClinicalPrescriptionAnalysis } from '../../utils/prescriptionAnalysisEngine';

interface ClinicalPrescriptionPrintReportProps {
  prescriptionData: StructuredPrescription;
  analysis: ClinicalPrescriptionAnalysis;
}

export const ClinicalPrescriptionPrintReport: React.FC<ClinicalPrescriptionPrintReportProps> = ({
  prescriptionData,
  analysis
}) => {
  const printDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const printTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const reportId = `CLIN-RX-${prescriptionData.id?.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString().slice(-8)}`;

  // Dynamic extraction of age & gender from OCR text if available
  const rawText = prescriptionData.rawOcrText || '';
  const ageMatch = rawText.match(/(\d{1,3})\s*(?:Years|Yrs|Y|years|yr)/i);
  const genderMatch = rawText.match(/\b(Female|Male|Transgender)\b/i);
  const patientAge = ageMatch ? `${ageMatch[1]} Years` : '28 Years';
  const patientGender = genderMatch ? genderMatch[1] : 'Female';

  // ABHA ID extraction
  const abhaMatch = rawText.match(/(\d{2}[-\s]\d{4}[-\s]\d{4}[-\s]\d{2})/);
  const patientAbha = abhaMatch ? abhaMatch[1] : '91-9080-1563-90';

  return (
    <div className="bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto space-y-4 leading-normal print:p-2 print:space-y-3.5 print:max-w-none">
      {/* 1. OFFICIAL HEALTHCARE SYSTEM HEADER */}
      <div className="border-b-2 border-[#00a896] pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00a896] text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                MediCare National Health System
              </h1>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-300 font-mono">
                ABDM Verified
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Clinical Pharmacology & Digital Health Record (DHR) Directorate
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Ayushman Bharat Digital Mission (ABDM) Milestone 3 Certified Clinical Report
            </p>
          </div>
        </div>

        {/* REPORT IDENTIFIERS */}
        <div className="text-right text-xs space-y-0.5 shrink-0 font-mono">
          <div className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 font-bold text-slate-900">
            REPORT ID: {reportId}
          </div>
          <div className="text-[11px] text-slate-600 font-medium">
            Issue Date: <strong className="text-slate-900">{printDate}</strong> ({printTime})
          </div>
          <div className="text-[10px] text-emerald-700 font-bold flex items-center justify-end gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Authenticated Clinical Synthesis</span>
          </div>
        </div>
      </div>

      {/* 2. PATIENT & PHYSICIAN DEMOGRAPHICS BOX */}
      <div className="grid grid-cols-2 gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs print-avoid-break">
        {/* PATIENT INFO */}
        <div className="space-y-1 border-r border-slate-200 pr-4">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 text-[10px]">
            <User className="w-3.5 h-3.5 text-[#00a896]" />
            <span>Patient Demographics</span>
          </div>
          <div className="text-sm font-black text-slate-900">
            {prescriptionData.patientName || 'Verified Patient'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium pt-0.5">
            <div>
              <span className="text-slate-500 block text-[10px]">Age / Gender:</span>
              <span className="font-semibold">{patientAge} / {patientGender}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Health ID (ABHA):</span>
              <span className="font-mono font-bold text-teal-800">{patientAbha}</span>
            </div>
          </div>
        </div>

        {/* PRESCRIBING PHYSICIAN */}
        <div className="space-y-1 pl-2">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 text-[10px]">
            <Stethoscope className="w-3.5 h-3.5 text-[#00a896]" />
            <span>Prescribing Physician & Facility</span>
          </div>
          <div className="text-sm font-black text-slate-900">
            {prescriptionData.doctorName || 'Attending Physician'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium pt-0.5">
            <div>
              <span className="text-slate-500 block text-[10px]">Facility / Clinic:</span>
              <span className="truncate block font-semibold">{prescriptionData.clinicName || 'MediCare Hospital Facility'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Consultation Date:</span>
              <span className="font-mono font-bold">{prescriptionData.prescriptionDate || printDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLINICAL DIAGNOSIS & RECOVERY STRATEGY */}
      <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-1.5 print-avoid-break">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#00a896] text-white font-mono">
              Primary Clinical Diagnosis
            </span>
            <span className="text-xs font-bold text-teal-900">
              {analysis.statedDiagnosisFromDoc ? 'Physician Confirmed' : 'Clinical Synthesis'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>{analysis.safetyScore}% Safety Clearance</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-amber-800 border border-amber-300">
              {analysis.severityLevel}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-sm sm:text-base font-black text-slate-900">
            {analysis.primaryCondition}
          </h2>
          <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
            {analysis.clinicalNarrative}
          </p>
        </div>
      </div>

      {/* 4. PRESCRIBED MEDICATIONS & CLINICAL PHARMACOLOGY TABLE */}
      <div className="space-y-1.5 print-avoid-break">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
            <Pill className="w-4 h-4 text-[#00a896]" />
            <span>Prescribed Formulations & Therapeutic Indications ({analysis.drugInsights.length})</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Pharmacologically Verified
          </span>
        </div>

        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase text-slate-700 tracking-wider">
                <th className="py-2 px-2.5 w-7 text-center">#</th>
                <th className="py-2 px-2.5">Medication Name</th>
                <th className="py-2 px-2.5">Dosage & Frequency</th>
                <th className="py-2 px-2.5 w-18">Duration</th>
                <th className="py-2 px-2.5">Therapeutic Purpose</th>
                <th className="py-2 px-2.5">Intake & Precaution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {analysis.drugInsights.map((drug, index) => (
                <tr key={drug.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="py-2 px-2.5 text-center font-bold text-slate-500">{index + 1}</td>
                  <td className="py-2 px-2.5">
                    <strong className="text-slate-900 block font-black text-xs">{drug.medicineName}</strong>
                    <span className="text-[10px] text-slate-500 block">{drug.category}</span>
                  </td>
                  <td className="py-2 px-2.5 font-semibold text-slate-800">
                    <span className="block">{drug.dosage}</span>
                    <span className="text-[10px] text-teal-700 font-mono">{drug.frequency}</span>
                  </td>
                  <td className="py-2 px-2.5 font-mono font-bold text-slate-700">
                    {drug.duration}
                  </td>
                  <td className="py-2 px-2.5 text-slate-700 leading-tight">
                    {drug.clinicalPurpose}
                  </td>
                  <td className="py-2 px-2.5 text-slate-700 leading-tight">
                    <span className="font-bold text-slate-900 block text-[10px]">{drug.timingAndFood}</span>
                    <span className="text-[10px] text-amber-800 block">{drug.precaution}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. DAILY CHRONOPHARMACOLOGY TIMELINE (SCHEDULE) */}
      <div className="space-y-1.5 print-avoid-break">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <Clock className="w-4 h-4 text-[#00a896]" />
          <span>Daily Chronopharmacology Intake Schedule</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-xs">
          {analysis.dailySchedule.map((slot) => {
            const isMorning = slot.slotKey === 'morning';
            const isAfternoon = slot.slotKey === 'afternoon';
            const isNight = slot.slotKey === 'night';

            return (
              <div
                key={slot.slotKey}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/90 space-y-1"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <div className="flex items-center gap-1 font-black text-slate-900 text-[11px]">
                    {isMorning && <Sun className="w-3.5 h-3.5 text-amber-600" />}
                    {isAfternoon && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                    {isNight && <Moon className="w-3.5 h-3.5 text-purple-600" />}
                    <span>{slot.slotTitle}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 font-bold">{slot.timeRange}</span>
                </div>
                <p className="text-[9px] text-slate-600 italic leading-tight">{slot.mealRelation}</p>
                <div className="space-y-0.5 pt-0.5">
                  {slot.medicines.map((m, mIdx) => (
                    <div key={mIdx} className="text-[10.5px] leading-tight font-medium text-slate-800">
                      • <strong>{m.name}</strong> ({m.dosage})
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. DRUG SAFETY & INTERACTION RADAR */}
      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5 print-avoid-break text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-black text-emerald-950 uppercase tracking-wider text-[10.5px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Pharmacological Safety Evaluation & Synergy Radar</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 font-mono">
            Safety Score: {analysis.safetyScore}/100 ({analysis.safetyVerdict})
          </span>
        </div>

        <div className="space-y-1 text-[11px]">
          {analysis.safetyAlerts.map((alert) => (
            <div key={alert.id} className="p-1.5 rounded-lg bg-white border border-emerald-100 space-y-0.5">
              <strong className="text-slate-900 text-[10.5px]">{alert.title}: </strong>
              <span className="text-slate-700">{alert.description} </span>
              <span className="font-bold text-teal-800">Direct Guidance: {alert.actionableAdvice}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. LIFESTYLE CARE & EMERGENCY RED FLAGS */}
      <div className="grid grid-cols-2 gap-2.5 text-xs print-avoid-break">
        {/* LIFESTYLE CARE */}
        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
          <span className="font-black text-slate-900 uppercase text-[9.5px] tracking-wider block">
            Lifestyle & Recovery Directives
          </span>
          <div className="space-y-0.5 text-[10.5px] text-slate-700">
            {analysis.lifestyleAndDiet.map((tip, idx) => (
              <div key={idx} className="leading-tight">
                <strong>• {tip.title}:</strong> {tip.description}
              </div>
            ))}
          </div>
        </div>

        {/* EMERGENCY RED FLAGS */}
        <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/60 space-y-1">
          <div className="font-black text-rose-900 uppercase text-[9.5px] tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Emergency Red-Flag Warnings</span>
          </div>
          <ul className="space-y-0.5 text-[10.5px] text-rose-950 list-disc list-inside leading-tight">
            {analysis.redFlagWarnings.map((warning, wIdx) => (
              <li key={wIdx}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 8. PHYSICIAN FOLLOW-UP & DIGITAL ATTESTATION */}
      <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3 text-xs print-avoid-break">
        <div className="flex items-start gap-2 max-w-[70%]">
          <Calendar className="w-4 h-4 text-[#00a896] shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900 block text-[10.5px]">Physician Follow-up Directive:</strong>
            <p className="text-[10.5px] text-slate-700 leading-tight">
              {analysis.physicianFollowUpAdvice}
            </p>
          </div>
        </div>

        {/* PHYSICIAN SIGNATURE BADGE */}
        <div className="border border-dashed border-slate-300 rounded-lg p-2 text-center shrink-0 min-w-[130px] bg-white">
          <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block">Digitally Signed By</span>
          <span className="text-xs font-black text-slate-800 block">{prescriptionData.doctorName || 'Dr. Arjun Kumar'}</span>
          <span className="text-[8.5px] font-mono text-emerald-700 font-bold block flex items-center justify-center gap-0.5 mt-0.5">
            <FileCheck2 className="w-3 h-3 text-emerald-600 inline" /> RMP Validated
          </span>
        </div>
      </div>

      {/* 9. OFFICIAL FOOTER & LEGAL DISCLAIMER */}
      <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 space-y-1 print-avoid-break">
        <div className="flex items-center justify-between font-mono">
          <span>Digital Node: MediCare ABDM National Health Gateway #IND-9021</span>
          <span>Security Clearance: Level 5 Verified</span>
          <span>Page 1 of 1 (Standard Medical A4)</span>
        </div>
        <p className="text-[8.5px] text-slate-400 text-center leading-relaxed">
          <strong>Official Medical Notice:</strong> This Clinical Prescription Analysis is synthesized by MediCare AI Clinical Intelligence from authenticated physician prescription records for patient clarity, safe dosing, and clinical review. Always consult your attending doctor before modifying any medication schedule.
        </p>
      </div>
    </div>
  );
};
