import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { patientExtendedApi } from '../../services/dhrApis';

interface FamilyConnectCardProps {
  onNavigate: (id: string) => void;
}

export const FamilyConnectCard: React.FC<FamilyConnectCardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    patientExtendedApi
      .getFamilyConnections()
      .then((res) => {
        if (mounted && Array.isArray(res?.data)) {
          setMembers(res.data);
        }
      })
      .catch(() => {
        if (mounted) setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const memberNames = members
    .map((m) => m.name || m.memberName || m.fullName)
    .filter(Boolean);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="p-6 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col justify-between space-y-4 group font-sans"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-teal-500/10 text-[#00a896] dark:text-teal-400 border border-teal-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('nav.family', 'Family Connect Network')}
            </h3>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">{t('card.shared_emergency_records', 'Shared Dependent Records')}</span>
          </div>
        </div>

        <span className="px-3 py-1 text-[10px] font-black uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full border border-purple-500/30 font-mono">
          {members.length} {members.length === 1 ? 'Member' : t('card.family_members', 'Members')}
        </span>
      </div>

      {/* MEMBERS AVATARS PREVIEW */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 font-mono text-xs">
        {members.length > 0 ? (
          <>
            <div className="flex items-center -space-x-2 shrink-0">
              {members.slice(0, 4).map((member, idx) => {
                const name = member.name || member.memberName || member.fullName || 'Member';
                const initials = name
                  .split(' ')
                  .map((p: string) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return member.avatarUrl ? (
                  <img
                    key={member.id || idx}
                    src={member.avatarUrl}
                    alt={name}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 object-cover"
                  />
                ) : (
                  <div
                    key={member.id || idx}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-black text-[10px] flex items-center justify-center"
                    title={name}
                  >
                    {initials}
                  </div>
                );
              })}
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-sans font-bold truncate">
              {memberNames.slice(0, 3).join(', ')}
              {memberNames.length > 3 ? ` +${memberNames.length - 3}` : ''}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400 font-sans font-medium">
            No family members linked yet. Add family contacts to share emergency records.
          </span>
        )}
      </div>

      {/* FOOTER LINK */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
        <button
          onClick={() => onNavigate('family')}
          className="inline-flex items-center gap-1.5 font-extrabold text-[#00a896] dark:text-cyan-400 hover:underline transition-colors cursor-pointer font-sans"
        >
          <span>{t('nav.family', 'Open Family Connect')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold">
          {members.length > 0 ? t('card.linked', 'Records Synced') : 'Not Linked'}
        </span>
      </div>
    </motion.div>
  );
};
