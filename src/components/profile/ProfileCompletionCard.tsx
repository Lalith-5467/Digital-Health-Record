import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { profileApi, patientClinicalApi } from '../../services/dhrApis';

interface ProfileCompletionCardProps {
  onOpenEdit: () => void;
  onOpenAllergy: () => void;
  completionPercentage?: number;
  hasEmergencyContact?: boolean;
  hasAllergies?: boolean;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({
  onOpenEdit,
  onOpenAllergy,
  completionPercentage: propCompletion,
  hasEmergencyContact: propHasEmergency,
  hasAllergies: propHasAllergies,
}) => {
  const { t } = useLanguage();
  const [computedPct, setComputedPct] = useState<number>(propCompletion ?? 0);
  const [hasEmergency, setHasEmergency] = useState<boolean>(propHasEmergency ?? false);
  const [hasAllergies, setHasAllergies] = useState<boolean>(propHasAllergies ?? false);

  useEffect(() => {
    if (typeof propCompletion === 'number') {
      setComputedPct(propCompletion);
      if (typeof propHasEmergency === 'boolean') setHasEmergency(propHasEmergency);
      if (typeof propHasAllergies === 'boolean') setHasAllergies(propHasAllergies);
      return;
    }

    let mounted = true;
    Promise.all([
      profileApi.getPatientProfile().catch(() => ({ data: null })),
      patientClinicalApi.getAllergies().catch(() => ({ data: [] })),
      patientClinicalApi.getEmergencyContacts().catch(() => ({ data: [] })),
    ]).then(([profRes, algRes, contactsRes]) => {
      if (!mounted) return;
      const p = profRes?.data;
      const algs = Array.isArray(algRes?.data) ? algRes.data : [];
      const contacts = Array.isArray(contactsRes?.data) ? contactsRes.data : [];
      const emergOk = Boolean(p?.emergencyContactPhone || p?.emergencyContactName || contacts.length > 0);
      const algOk = algs.length > 0;
      const fields = [
        Boolean(p?.fullName),
        Boolean(p?.dateOfBirth),
        Boolean(p?.gender),
        Boolean(p?.bloodGroup),
        Boolean(p?.address),
        Boolean(p?.heightCm),
        Boolean(p?.weightKg),
        emergOk,
        algOk,
      ];
      setComputedPct(Math.round((fields.filter(Boolean).length / fields.length) * 100));
      setHasEmergency(emergOk);
      setHasAllergies(algOk);
    });

    return () => {
      mounted = false;
    };
  }, [propCompletion, propHasEmergency, propHasAllergies]);

  return (
    <div className="p-5 h-full rounded-3xl bg-gradient-to-br from-teal-50 via-blue-50/50 to-fuchsia-100 dark:from-teal-900/30 dark:via-blue-900/20 dark:to-fuchsia-900/20 border border-slate-200/50 dark:border-slate-800 shadow-xl space-y-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10 dark:hover:shadow-purple-500/5 group">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#00cba9] flex items-center justify-center shadow-sm">
            <Check className="w-4 h-4 text-slate-900 dark:text-white" strokeWidth={3} />
          </div>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('profile.completion', 'Profile Completion')}
          </h3>
        </div>
        <span className="text-base font-black text-[#00cba9]">{computedPct}%</span>
      </div>

      {/* PROGRESS BAR */}
      <div className="w-full h-2.5 rounded-full bg-slate-200/60 dark:bg-slate-800/60 overflow-hidden">
        <div
          style={{ width: `${computedPct}%` }}
          className="h-full bg-gradient-to-r from-[#00cba9] to-[#6366f1] rounded-full transition-all duration-700"
        />
      </div>

      <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
        {computedPct >= 100
          ? 'Your health profile is complete and ready for emergency access.'
          : t('profile.completion_desc', 'Complete your profile to improve your health experience and emergency readiness.')}
      </p>

      {/* ACTION BUTTONS (STACKED) */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          onClick={onOpenEdit}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-[#d97706] dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/30 text-[13px] font-bold transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {hasEmergency ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4" />}
            <span>{hasEmergency ? 'Update Emergency Contact' : t('profile.add_emergency_contact', 'Add Emergency Contact')}</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenAllergy}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-[#e11d48] dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/30 text-[13px] font-bold transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {hasAllergies ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4" />}
            <span>{hasAllergies ? 'Manage Allergy Info' : t('profile.add_allergy_info', 'Add Allergy Info')}</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
