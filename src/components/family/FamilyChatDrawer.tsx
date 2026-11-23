import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import type { FamilyMember, FamilyChatMessage } from './familyData';
import { patientExtendedApi, profileApi } from '../../services/dhrApis';

interface FamilyChatDrawerProps {
  member: FamilyMember | null;
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
}

export const FamilyChatDrawer: React.FC<FamilyChatDrawerProps> = ({
  member,
  isOpen,
  onClose,
  onMessageSent,
}) => {
  const [messages, setMessages] = useState<FamilyChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('You');

  useEffect(() => {
    if (!isOpen || !member) return;
    let active = true;
    setLoading(true);

    Promise.all([
      profileApi.getProfile().catch(() => null),
      patientExtendedApi.getFamilyMessages(member.id).catch(() => null),
    ]).then(([profRes, msgRes]) => {
      if (!active) return;
      const uid = profRes?.data?.id || null;
      const uname = profRes?.data?.profile?.fullName || (profRes?.data as any)?.fullName || 'You';
      setCurrentUserId(uid);
      setCurrentUserName(uname);

      if (msgRes?.data && Array.isArray(msgRes.data)) {
        setMessages(
          msgRes.data.map((m: any) => {
            const isSelf = !uid || m.senderUserId === uid;
            return {
              id: m.id,
              sender: isSelf ? 'Self' : 'Member',
              senderName: isSelf ? uname : `${member.name} (${member.relationship})`,
              text: m.text,
              timestamp: m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '',
              isRead: true,
            };
          })
        );
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await patientExtendedApi.postFamilyMessage(member.id, trimmed);
      const created = res?.data;
      const newMsg: FamilyChatMessage = {
        id: created?.id || `MSG-${Date.now()}`,
        sender: 'Self',
        senderName: currentUserName,
        text: created?.text || trimmed,
        timestamp: created?.createdAt
          ? new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: true,
      };
      setMessages((prev) => [...prev, newMsg]);
      setInputMessage('');
      onMessageSent?.();
    } catch (err) {
      console.error('Failed to send family message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md h-[85vh] sm:max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col h-full">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  className="w-10 h-10 rounded-2xl object-cover border-2 border-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-[#00a896] font-extrabold text-sm flex items-center justify-center border border-teal-500/20">
                  {member.name?.slice(0, 2).toUpperCase() || 'FM'}
                </div>
              )}
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">{member.name}</h3>
                <span className="text-[10px] font-extrabold text-[#00a896] font-mono">
                  {member.relationship} • Connected
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CHAT MESSAGES STREAM */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs scrollbar-thin">
            {loading ? (
              <div className="text-center text-slate-400 py-8 font-medium">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-400 py-10 space-y-1">
                <p className="font-bold text-slate-600 dark:text-slate-300">No messages yet</p>
                <p className="text-[11px]">Send a message to {member.name} to start a care conversation.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'Self' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1 px-1">{msg.senderName} • {msg.timestamp}</span>
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] leading-relaxed shadow-sm ${
                      msg.sender === 'Self'
                        ? 'bg-gradient-to-br from-[#00a896] to-cyan-600 text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* INPUT FORM */}
          <form onSubmit={handleSendMessage} className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Message ${member.name}...`}
              disabled={sending}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896] transition-all"
            />
            <button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              className="p-3 rounded-xl bg-gradient-to-r from-[#00a896] to-cyan-500 hover:from-[#00897b] hover:to-cyan-600 text-white transition-all shadow-md shadow-teal-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
