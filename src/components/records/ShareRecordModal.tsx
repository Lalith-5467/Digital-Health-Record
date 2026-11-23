import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Check, UserCheck, Users } from 'lucide-react';
import type { MedicalRecordItem } from './recordsData';
import { healthShareApi } from '../../services/healthShareApi';
import { patientExtendedApi } from '../../services/dhrApis';

interface ShareRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MedicalRecordItem | null;
  onToast: (msg: string) => void;
}

export const ShareRecordModal: React.FC<ShareRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  onToast
}) => {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [generatingToken, setGeneratingToken] = useState(false);
  const [sharingFamily, setSharingFamily] = useState(false);

  useEffect(() => {
    if (!isOpen || !record) {
      setShareLink('');
      return;
    }
    let mounted = true;
    setGeneratingToken(true);
    healthShareApi
      .generateQRToken(30)
      .then((res) => {
        if (mounted && res?.token) {
          setShareLink(`${window.location.origin}/share?token=${encodeURIComponent(res.token)}&recordId=${encodeURIComponent(record.id)}`);
        }
      })
      .catch(() => {
        if (mounted) setShareLink('');
      })
      .finally(() => {
        if (mounted) setGeneratingToken(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, record?.id]);

  if (!isOpen || !record) return null;

  const handleCopyLink = async () => {
    let linkToCopy = shareLink;
    if (!linkToCopy) {
      try {
        setGeneratingToken(true);
        const res = await healthShareApi.generateQRToken(30);
        linkToCopy = `${window.location.origin}/share?token=${encodeURIComponent(res.token)}&recordId=${encodeURIComponent(record.id)}`;
        setShareLink(linkToCopy);
      } catch (err: any) {
        onToast(err?.message || 'Unable to generate secure share link');
        setGeneratingToken(false);
        return;
      } finally {
        setGeneratingToken(false);
      }
    }

    await navigator.clipboard?.writeText(linkToCopy).catch(() => {});
    setCopied(true);
    onToast('✓ Encrypted 30-minute sharing link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWithDoctor = async () => {
    try {
      setGeneratingToken(true);
      const qr = await healthShareApi.generateQRToken(30);
      const url = `${window.location.origin}/share?token=${encodeURIComponent(qr.token)}&recordId=${encodeURIComponent(record.id)}`;
      setShareLink(url);
      await navigator.clipboard?.writeText(url).catch(() => {});
      onToast(`✓ Generated ABDM Consent token for "${record.title}" (valid 30 min) and copied to clipboard`);
      onClose();
    } catch (err: any) {
      onToast(err?.message || 'Failed to generate ABDM doctor share token');
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleShareWithFamily = async () => {
    if (sharingFamily) return;
    setSharingFamily(true);
    try {
      const famRes = await patientExtendedApi.getFamilyConnections().catch(() => ({ data: [] }));
      const members = Array.isArray(famRes?.data) ? famRes.data : [];
      if (members.length === 0) {
        onToast('No linked family members found. Connect a family member in Family Connect first.');
        setSharingFamily(false);
        return;
      }

      await Promise.all(
        members.map((member: any) =>
          patientExtendedApi.shareFamilyItem({
            connectionId: member.id,
            itemType: 'MEDICAL_RECORD',
            itemId: record.id,
            title: record.title,
            notes: `Shared ${record.type} (${record.date})`,
          })
        )
      );

      onToast(`✓ Shared "${record.title}" with ${members.length} linked family member${members.length === 1 ? '' : 's'}`);
      onClose();
    } catch (err: any) {
      onToast(err?.message || 'Failed to share record with family vault');
    } finally {
      setSharingFamily(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white space-y-4 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Share Medical Record</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">{record.title}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            {/* COPY LINK OPTION */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">Encrypted 30-Minute Access Link</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatingToken ? 'Generating secure ABDM token...' : (shareLink || 'Click Copy to generate secure link')}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  disabled={generatingToken}
                  className="px-3 py-2 rounded-xl bg-[#00a896] hover:bg-[#00897b] text-white font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs disabled:opacity-60"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* DIRECT SHARE ACTION BUTTONS */}
            <button
              onClick={handleShareWithDoctor}
              disabled={generatingToken}
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold transition-all flex items-center justify-between cursor-pointer group disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-[#00a896] dark:text-cyan-400" />
                <span>Generate Doctor Share Token (ABDM Consent)</span>
              </div>
            </button>

            <button
              onClick={handleShareWithFamily}
              disabled={sharingFamily}
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold transition-all flex items-center justify-between cursor-pointer group disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{sharingFamily ? 'Sharing with Family Vault...' : 'Share with Linked Family Vault'}</span>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
