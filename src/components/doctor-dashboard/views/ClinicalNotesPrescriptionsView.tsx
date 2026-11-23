import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  CheckCircle2,
  Pill,
  Video,
  AlertCircle
} from 'lucide-react';
import { useDoctorWorkflow } from '../../../utils/doctorWorkflowStorage';
import { prescriptionApi, profileApi } from '../../../services/dhrApis';
import { useLanguage } from '../../../context/LanguageContext';

export const ClinicalNotesPrescriptionsView: React.FC = () => {
  const { records, loading, addPrescription, saveClinicalNotes } = useDoctorWorkflow();
  const { t } = useLanguage();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [doctorLabel, setDoctorLabel] = useState<string>('Attending Physician');

  const selectedPatient = records.find((p) => p.id === selectedPatientId) || records[0] || null;

  // Prescription Form State
  const [newMedName, setNewMedName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newFrequency, setNewFrequency] = useState('Twice daily after food');
  const [newInstructions, setNewInstructions] = useState('');
  const [notesText, setNotesText] = useState('');
  const [savingRx, setSavingRx] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Health Topics State
  const [availableTopics, setAvailableTopics] = useState<any[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  useEffect(() => {
    if (records.length > 0 && (!selectedPatientId || !records.some((r) => r.id === selectedPatientId))) {
      setSelectedPatientId(records[0].id);
      setNotesText(records[0].clinicalNotes || '');
    }
  }, [records, selectedPatientId]);

  useEffect(() => {
    prescriptionApi
      .getHealthTopics()
      .then((res) => {
        const list = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(list)) {
          setAvailableTopics(list);
        }
      })
      .catch((err) => console.error(err));

    profileApi
      .getDoctorProfile()
      .then((res) => {
        if (res?.data?.fullName) {
          const qual = res.data.qualification ? `, ${res.data.qualification}` : '';
          setDoctorLabel(`${res.data.fullName}${qual}`);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newMedName.trim() || !newDose.trim()) return;

    setSavingRx(true);
    try {
      await addPrescription(
        selectedPatient.id,
        {
          medicine: newMedName.trim(),
          dose: newDose.trim(),
          frequency: newFrequency,
          instructions: newInstructions.trim(),
          isAntibiotic:
            newMedName.toLowerCase().includes('cillin') || newMedName.toLowerCase().includes('biotic'),
        },
        {
          diagnosis: selectedPatient.diagnosis?.join(', ') || 'Clinical Consultation',
          notes: notesText || 'Prescription issued by attending physician',
          healthTopics: selectedTopics,
        }
      );

      const issuedName = newMedName.trim();
      setNewMedName('');
      setNewDose('');
      setNewInstructions('');
      setSelectedTopics([]);
      showToast(
        t(
          'doctor.prescriptions.rx_success',
          'E-Prescription for {medName} generated and saved to MySQL!'
        ).replace('{medName}', issuedName)
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to save prescription to MySQL database', true);
    } finally {
      setSavingRx(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedPatient || !notesText.trim()) return;
    setSavingNotes(true);
    try {
      await saveClinicalNotes(selectedPatient.id, notesText.trim());
      showToast(
        t(
          'doctor.prescriptions.notes_success',
          'Clinical EHR Encounter notes saved to MySQL Health Vault.'
        )
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to save clinical notes to database', true);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans select-none">

      {/* TOAST FEEDBACK */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`pointer-events-auto select-auto px-5 py-3 rounded-2xl text-white font-black text-xs shadow-2xl flex items-center gap-2 ${
              toastMsg.isError ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {toastMsg.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-cyan-400 text-xs font-black uppercase tracking-wider mb-1">
            <Pill className="w-3.5 h-3.5" /> {t("doctor.prescriptions.header_tag", "E-Prescriptions & Clinical Notes")}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {t("doctor.prescriptions.main_title", "Prescription Writer & Clinical Notes")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {t("doctor.prescriptions.main_subtitle", "Issue digitally signed prescriptions linked directly to the pharmacy & patient EHR vault.")}
          </p>
        </div>

        {/* PATIENT SELECTOR DROPDOWN */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold shadow-xs">
          <span className="text-slate-400 uppercase text-[10px]">{t("doctor.prescriptions.patient_label", "Patient")}:</span>
          <select
            value={selectedPatient?.id || ''}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              const p = records.find((r) => r.id === e.target.value);
              setNotesText(p?.clinicalNotes || '');
            }}
            disabled={records.length === 0}
            className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
          >
            {records.length === 0 ? (
              <option value="">{loading ? 'Loading patients...' : 'No patients available'}</option>
            ) : (
              records.map((p) => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {p.name} ({p.age})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: E-PRESCRIPTION GENERATOR */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-600" /> {t("doctor.prescriptions.new_med_title", "New Medication Prescription")}
            </h3>

            <form onSubmit={handleAddMed} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">{t("doctor.prescriptions.med_name_label", "Medicine Name & Formulation")}</label>
                  <input
                    type="text"
                    placeholder="e.g. Azithromycin 500mg"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                    required
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">{t("doctor.prescriptions.dose_label", "Dosage Strength")}</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Tablet"
                    value={newDose}
                    onChange={(e) => setNewDose(e.target.value)}
                    required
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">{t("doctor.prescriptions.freq_label", "Frequency & Timing")}</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white"
                  >
                    <option value="Once daily in the morning">{t("doctor.prescriptions.freq_morning", "Once daily in the morning")}</option>
                    <option value="Once daily at bedtime">{t("doctor.prescriptions.freq_night", "Once daily at bedtime")}</option>
                    <option value="Twice daily after food">{t("doctor.prescriptions.freq_twice", "Twice daily after food")}</option>
                    <option value="Three times daily after meals">{t("doctor.prescriptions.freq_thrice", "Three times daily after meals")}</option>
                    <option value="As needed for severe pain/fever">{t("doctor.prescriptions.freq_prn", "As needed for severe pain/fever")}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">{t("doctor.prescriptions.special_instr", "Special Clinical Instructions")}</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete 5 days course"
                    value={newInstructions}
                    onChange={(e) => setNewInstructions(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-500" />
                  {t("doctor.prescriptions.health_topics_label", "Health Education Topics (Video Prescriptions)")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTopics.map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                        selectedTopics.includes(topic.id)
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-400'
                      }`}
                    >
                      {topic.displayName}
                    </div>
                  ))}
                  {availableTopics.length === 0 && (
                    <span className="text-slate-400 text-xs italic">No health education topics configured.</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedPatient || savingRx}
                className="w-full py-3.5 bg-gradient-to-r from-[#00a896] to-teal-600 hover:from-teal-500 hover:to-teal-600 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-md shadow-teal-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Pill className="w-4 h-4" />
                <span>{savingRx ? 'Saving E-Prescription...' : t("doctor.prescriptions.issue_btn", "Issue & Sign E-Prescription")}</span>
              </button>
            </form>
          </div>

          {/* ACTIVE MEDICATIONS LIST */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {t("doctor.prescriptions.active_prescriptions_title", "Current Active Prescriptions for")} {selectedPatient?.name || '—'} ({selectedPatient?.medications?.length || 0})
            </h4>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {!selectedPatient || selectedPatient.medications.length === 0 ? (
                <p className="py-4 text-xs text-slate-400 text-center">No prescriptions recorded for this patient yet.</p>
              ) : (
                selectedPatient.medications.map((m) => (
                  <div key={m.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 dark:text-white">{m.medicine}</strong>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {m.dose}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{m.frequency} {m.instructions && `• ${m.instructions}`}</p>
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                      {m.adherencePercent != null
                        ? `${t("doctor.prescriptions.adherence", "Adherence")}: ${m.adherencePercent}%`
                        : m.status || 'Active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: CLINICAL NOTES / ENCOUNTER SUMMARY */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> {t("doctor.prescriptions.notes_header", "Clinical Encounter Notes")}
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{doctorLabel}</span>
            </div>

            <textarea
              rows={8}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder={t("doctor.prescriptions.notes_placeholder_2", "Record subjective history, objective clinical exam findings, differential diagnosis, and patient care recommendations...")}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium dark:text-white leading-relaxed focus:outline-none focus:border-teal-500"
            />

            <button
              onClick={handleSaveNotes}
              disabled={!selectedPatient || !notesText.trim() || savingNotes}
              className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-50 font-black rounded-2xl transition-all shadow-sm hover:scale-102 cursor-pointer flex items-center justify-center gap-2 text-xs"
            >
              <Send className="w-4 h-4" />
              <span>{savingNotes ? 'Saving Clinical Notes...' : t("doctor.prescriptions.save_publish", "Save & Publish to ABDM Health Record")}</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
