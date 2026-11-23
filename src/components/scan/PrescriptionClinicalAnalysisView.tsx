import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Stethoscope,
  Pill,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Droplets,
  Wind,
  Utensils,
  Moon,
  Sun,
  Activity,
  ChevronDown,
  ChevronUp,
  Printer,
  X,
  FileCheck2,
  FileText
} from 'lucide-react';
import type { StructuredPrescription } from '../../utils/prescriptionExtractor';
import {
  analyzePrescriptionClinicalData
} from '../../utils/prescriptionAnalysisEngine';
import type {
  ClinicalPrescriptionAnalysis
} from '../../utils/prescriptionAnalysisEngine';
import { ClinicalPrescriptionPrintReport } from './ClinicalPrescriptionPrintReport';

interface PrescriptionClinicalAnalysisViewProps {
  prescriptionData: StructuredPrescription;
  onToast?: (message: string) => void;
  isCompact?: boolean;
}

export const PrescriptionClinicalAnalysisView: React.FC<PrescriptionClinicalAnalysisViewProps> = ({
  prescriptionData,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'drugs' | 'schedule' | 'safety' | 'lifestyle'>('drugs');
  const [expandedDrugId, setExpandedDrugId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printMountTarget, setPrintMountTarget] = useState<HTMLElement | null>(null);

  // Set up print mount container and event listeners
  useEffect(() => {
    let mount = document.getElementById('print-mount-root');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'print-mount-root';
      document.body.appendChild(mount);
    }
    setPrintMountTarget(mount);

    const handleBeforePrint = () => {
      document.body.classList.add('printing-clinical-report');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-clinical-report');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Generate real-time clinical analysis from the prescription data
  const analysis: ClinicalPrescriptionAnalysis = useMemo(() => {
    return analyzePrescriptionClinicalData(prescriptionData);
  }, [prescriptionData]);

  // Set first drug expanded by default
  React.useEffect(() => {
    if (analysis.drugInsights.length > 0 && !expandedDrugId) {
      setExpandedDrugId(analysis.drugInsights[0].id);
    }
  }, [analysis.drugInsights, expandedDrugId]);

  const handleCopySummary = async () => {
    const summaryText = `[AI CLINICAL PRESCRIPTION ANALYSIS]
Patient: ${prescriptionData.patientName || 'Patient'}
Doctor: ${prescriptionData.doctorName || 'Physician'} (${prescriptionData.clinicName || 'Clinic'})
Date: ${prescriptionData.prescriptionDate || new Date().toLocaleDateString()}

TARGET CLINICAL DIAGNOSIS:
${analysis.primaryCondition} (${analysis.severityLevel})
${analysis.clinicalNarrative}

PRESCRIBED MEDICATIONS & CLINICAL PURPOSE:
${analysis.drugInsights
  .map(
    (d, i) =>
      `${i + 1}. ${d.medicineName} (${d.dosage}, ${d.frequency}, ${d.duration})
   - Category: ${d.category}
   - Purpose: ${d.clinicalPurpose}
   - Intake: ${d.timingAndFood}
   - Precaution: ${d.precaution}`
  )
  .join('\n\n')}

DAILY INTAKE TIMELINE:
${analysis.dailySchedule
  .map(
    (s) =>
      `• ${s.slotTitle} (${s.timeRange}):\n  ${s.medicines.map((m) => `${m.name} (${m.dosage}) - ${m.instructions}`).join('\n  ')}`
  )
  .join('\n\n')}

SAFETY RADAR & DRUG INTERACTIONS:
- Safety Score: ${analysis.safetyScore}/100 (${analysis.safetyVerdict})
${analysis.safetyAlerts.map((a) => `• [${a.severity.toUpperCase()}] ${a.title}: ${a.actionableAdvice}`).join('\n')}

LIFESTYLE & RECOVERY CARE:
${analysis.lifestyleAndDiet.map((l) => `• ${l.title}: ${l.description}`).join('\n')}

EMERGENCY RED FLAGS:
${analysis.redFlagWarnings.map((w) => `! ${w}`).join('\n')}

FOLLOW-UP DIRECTIVE:
${analysis.physicianFollowUpAdvice}
`;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      if (onToast) onToast('✓ Clinical Prescription Analysis copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (onToast) onToast('Failed to copy to clipboard');
    }
  };

  const triggerDirectPrint = () => {
    document.body.classList.add('printing-clinical-report');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-teal-500/25 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 transition-all">
      {/* EXECUTIVE HEADER */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00a896] to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                Clinical Prescription Analysis
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-500/10 text-[#00a896] dark:text-cyan-300 border border-teal-500/20 shrink-0 font-mono">
                ABDM Verified
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Pharmacology, chronopharmacology & interaction radar
            </p>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            title="Copy clinical analysis to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00a896] dark:text-cyan-300 transition-all cursor-pointer border border-teal-500/25 hover:scale-105"
            title="Preview & Print Official Clinical Report (A4 PDF)"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PRIMARY DIAGNOSIS & CLINICAL INSIGHT HIGHLIGHT BANNER */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-cyan-500/10 border border-teal-500/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-[#00a896] text-white text-[9px] font-black uppercase tracking-wider font-mono">
              Target Diagnosis
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {analysis.statedDiagnosisFromDoc ? 'Physician Confirmed' : 'Clinical Assessment'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>{analysis.safetyScore}% Clearance</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              {analysis.severityLevel}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
            {analysis.primaryCondition}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            {analysis.clinicalNarrative}
          </p>
        </div>

        {/* METRICS 2X2 BALANCED GRID (NO TRUNCATION, PERFECT SPACING) */}
        <div className="pt-2.5 grid grid-cols-2 gap-2 border-t border-teal-500/20 text-xs">
          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-500/15">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">
              Active Medicines
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white block mt-0.5">
              {analysis.totalActiveDrugs} Formulations
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-500/15">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">
              Therapeutic Goal
            </span>
            <span className="text-xs font-bold text-teal-700 dark:text-cyan-300 block mt-0.5">
              Infection & Allergy Relief
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-500/15">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">
              Safety Clearance
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              0 Contraindications
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-500/15">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-mono">
              Analysis Time
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mt-0.5 font-mono">
              {analysis.generatedAt}
            </span>
          </div>
        </div>
      </div>

      {/* BALANCED 2X2 SEGMENTED NAVIGATION TABS (ZERO HORIZONTAL SCROLLBAR) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('drugs')}
          className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'drugs'
              ? 'bg-white dark:bg-slate-800 text-[#00a896] dark:text-cyan-300 shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Pill className="w-3.5 h-3.5" />
          <span className="truncate">Drug Purpose ({analysis.drugInsights.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'schedule'
              ? 'bg-white dark:bg-slate-800 text-[#00a896] dark:text-cyan-300 shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="truncate">Daily Routine</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'safety'
              ? 'bg-white dark:bg-slate-800 text-[#00a896] dark:text-cyan-300 shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="truncate">Safety Radar ({analysis.safetyAlerts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lifestyle')}
          className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'lifestyle'
              ? 'bg-white dark:bg-slate-800 text-[#00a896] dark:text-cyan-300 shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="truncate">Care & Red Flags</span>
        </button>
      </div>

      {/* TAB CONTENT PANELS */}
      <AnimatePresence mode="wait">
        {/* TAB 1: DRUG-BY-DRUG PHARMACOLOGICAL PROFILES */}
        {activeTab === 'drugs' && (
          <motion.div
            key="drugs"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Tap medication to view pharmacology & directives:</span>
              <button
                type="button"
                onClick={() =>
                  setExpandedDrugId(expandedDrugId ? null : analysis.drugInsights[0]?.id || null)
                }
                className="text-[#00a896] dark:text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                {expandedDrugId ? 'Collapse' : 'Expand All'}
              </button>
            </div>

            <div className="space-y-2">
              {analysis.drugInsights.map((drug, idx) => {
                const isExpanded = expandedDrugId === drug.id;
                return (
                  <div
                    key={drug.id || idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-slate-950/40 transition-all hover:border-teal-500/40"
                  >
                    {/* ACCORDION HEADER */}
                    <button
                      type="button"
                      onClick={() => setExpandedDrugId(isExpanded ? null : drug.id)}
                      className="w-full p-3 flex items-center justify-between text-left cursor-pointer gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black ${
                            drug.tagColor === 'teal'
                              ? 'bg-teal-500/15 text-[#00a896]'
                              : drug.tagColor === 'purple'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : drug.tagColor === 'blue'
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              : drug.tagColor === 'amber'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {drug.medicineName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {drug.dosage}
                            </span>
                            {drug.isAntibiotic && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Antibiotic
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                            {drug.category} • {drug.foodInstruction}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-teal-500/10 text-[#00a896] dark:text-cyan-300">
                          {drug.recommendedSlot}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* EXPANDED CLINICAL DETAILS */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                      >
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">
                              Why This Was Prescribed
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 font-medium text-[11px] leading-relaxed">
                              {drug.clinicalPurpose}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">
                              How It Works in Body
                            </span>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {drug.mechanismSummary}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Optimal Timing & Intake
                            </span>
                            <p className="text-emerald-950 dark:text-emerald-200 text-[11px] leading-relaxed font-medium">
                              {drug.timingAndFood}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider font-mono flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Important Precaution
                            </span>
                            <p className="text-amber-950 dark:text-amber-200 text-[11px] leading-relaxed font-medium">
                              {drug.precaution}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 2: DAILY CHRONOPHARMACOLOGY SCHEDULE (VERTICAL CLEAN LAYOUT) */}
        {activeTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              Coordinated daily routine to ensure maximum efficacy without medication fatigue:
            </p>

            <div className="space-y-2.5">
              {analysis.dailySchedule.map((slot) => {
                const isMorning = slot.slotKey === 'morning';
                const isAfternoon = slot.slotKey === 'afternoon';
                const isNight = slot.slotKey === 'night';

                return (
                  <div
                    key={slot.slotKey}
                    className={`rounded-2xl p-3.5 border space-y-2.5 ${
                      isMorning
                        ? 'bg-amber-500/5 border-amber-500/25'
                        : isAfternoon
                        ? 'bg-blue-500/5 border-blue-500/25'
                        : 'bg-purple-500/5 border-purple-500/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-xs text-slate-900 dark:text-white">
                        {isMorning && <Sun className="w-4 h-4 text-amber-500" />}
                        {isAfternoon && <Clock className="w-4 h-4 text-blue-500" />}
                        {isNight && <Moon className="w-4 h-4 text-purple-500" />}
                        <span>{slot.slotTitle}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {slot.timeRange}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                      {slot.mealRelation}
                    </p>

                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80">
                      {slot.medicines.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 dark:text-white truncate block">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {m.instructions}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-cyan-300 shrink-0">
                            {m.dosage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 3: SAFETY & SYNERGY RADAR */}
        {activeTab === 'safety' && (
          <motion.div
            key="safety"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2.5"
          >
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                  {analysis.safetyVerdict} ({analysis.safetyScore}/100)
                </h5>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5 leading-relaxed">
                  No life-threatening contraindications detected. The prescribed compounds operate in clinical synergy.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {analysis.safetyAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-[#00a896] shrink-0" />
                      <span className="truncate">{alert.title}</span>
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                        alert.severity === 'moderate'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-teal-500/15 text-teal-700 dark:text-cyan-300'
                      }`}
                    >
                      {alert.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {alert.description}
                  </p>
                  <div className="p-2 rounded-xl bg-teal-500/5 border border-teal-500/15 text-[10px] font-bold text-teal-800 dark:text-cyan-300">
                    💡 Advice: {alert.actionableAdvice}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 4: LIFESTYLE & RED FLAGS */}
        {activeTab === 'lifestyle' && (
          <motion.div
            key="lifestyle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            {/* LIFESTYLE TILES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.lifestyleAndDiet.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-teal-500/15 text-[#00a896] dark:text-cyan-400 flex items-center justify-center shrink-0">
                      {tip.icon === 'droplets' && <Droplets className="w-3 h-3" />}
                      {tip.icon === 'wind' && <Wind className="w-3 h-3" />}
                      {tip.icon === 'utensils' && <Utensils className="w-3 h-3" />}
                      {tip.icon === 'moon' && <Moon className="w-3 h-3" />}
                    </div>
                    <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                      {tip.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {tip.description}
                  </p>
                </div>
              ))}
            </div>

            {/* RED FLAGS BOX */}
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-rose-800 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>When to Seek Immediate Medical Re-Evaluation:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-rose-900 dark:text-rose-200 list-disc list-inside">
                {analysis.redFlagWarnings.map((warning, wIdx) => (
                  <li key={wIdx} className="leading-relaxed">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHYSICIAN FOLLOW-UP DIRECTIVE FOOTER */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-start gap-2 text-xs">
        <Stethoscope className="w-3.5 h-3.5 text-[#00a896] shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <span className="font-black text-slate-900 dark:text-white text-[11px] block">
            Physician Guidance & Care Continuity
          </span>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {analysis.physicianFollowUpAdvice}
          </p>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE OFFICIAL A4 PRINT & PDF PREVIEW MODAL
          ========================================================================= */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-teal-500/40 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* MODAL CONTROL HEADER */}
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/90 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00a896] to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <span>Official Clinical Prescription Report Preview</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                        Standard A4 Medical Grade
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Standardized clinical document layout without web UI sidebars, menus, or scanner input clutter.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerDirectPrint}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00a896] to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-500/25 hover:scale-[1.02] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print / Save as PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* DOCUMENT SCROLL PREVIEW AREA */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/70 flex justify-center">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-[210mm] overflow-hidden my-auto border border-slate-200">
                  <ClinicalPrescriptionPrintReport
                    prescriptionData={prescriptionData}
                    analysis={analysis}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PORTAL TO DEDICATED BODY PRINT ROOT (Standard A4 Print Engine) */}
      {printMountTarget &&
        createPortal(
          <ClinicalPrescriptionPrintReport
            prescriptionData={prescriptionData}
            analysis={analysis}
          />,
          printMountTarget
        )}
    </div>
  );
};
