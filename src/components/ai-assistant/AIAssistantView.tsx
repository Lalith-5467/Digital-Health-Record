import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../ui/PageHeader';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type {
  ChatMessage,
  ChatConversation,
  SavedHealthNote,
  HealthTopicItem,
  AIAssistantSettingsState,
  HealthTipItem
} from './aiAssistantData';
import {
  HEALTH_TOPICS_DATABASE,
  DEFAULT_AI_SETTINGS,
  generateDemoAIResponse
} from './aiAssistantData';
import { AIAssistantProfileSidebar } from './AIAssistantProfileSidebar';
import { AIChatArea } from './AIChatArea';
import { HealthSnapshotInsightsPanel } from './HealthSnapshotInsightsPanel';
import { DoctorVisitPrepModal } from './DoctorVisitPrepModal';
import { MedicalTermExplainerModal } from './MedicalTermExplainerModal';
import { HealthTopicDrawer } from './HealthTopicDrawer';
import { ChatHistoryDrawer } from './ChatHistoryDrawer';
import { SavedHealthNotesModal } from './SavedHealthNotesModal';
import { AIChatSettingsDrawer } from './AIChatSettingsDrawer';
import { patientExtendedApi, profileApi } from '../../services/dhrApis';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  abhaId: string;
  bloodGroup: string;
  age: number;
}

interface AIAssistantViewProps {
  user?: UserProfile;
  onNavigate: (page: string) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  user: _user,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // CHAT STATE
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatConversation[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedHealthNote[]>([]);
  const [settings, setSettings] = useState<AIAssistantSettingsState>(DEFAULT_AI_SETTINGS);

  // MODALS & DRAWERS
  const [doctorPrepOpen, setDoctorPrepOpen] = useState(false);
  const [termExplainerOpen, setTermExplainerOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<HealthTopicItem | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [savedNotesModalOpen, setSavedNotesModalOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [cachedHealthPrefs, setCachedHealthPrefs] = useState<Record<string, any>>({});

  const loadAiData = async () => {
    try {
      const [convRes, notesRes, prefRes] = await Promise.all([
        patientExtendedApi.getAiConversations().catch(() => null),
        patientExtendedApi.getSavedHealthNotes().catch(() => null),
        profileApi.getPreferences().catch(() => null),
      ]);
      if (convRes?.data && Array.isArray(convRes.data)) {
        setChatHistory(
          convRes.data.map((c: any) => ({
            id: c.id,
            title: c.title || 'Health Consultation',
            date: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent',
            messages: (c.messages || []).map((m: any) => ({
              id: m.id,
              sender: m.sender === 'assistant' ? 'ai' : 'user',
              content: m.text,
              timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            })),
          }))
        );
      }
      if (notesRes?.data && Array.isArray(notesRes.data)) {
        setSavedNotes(
          notesRes.data.map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            date: n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recent',
          }))
        );
      }
      const healthPrefs = prefRes?.data?.health;
      if (healthPrefs && typeof healthPrefs === 'object') {
        setCachedHealthPrefs(healthPrefs);
        if (healthPrefs.aiSettings) {
          setSettings((prev) => ({ ...prev, ...healthPrefs.aiSettings }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadAiData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendMessage = async (userText: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `MSG-${Date.now()}-USER`,
      sender: 'user',
      content: userText,
      timestamp: timeStr
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);

    let convId = activeConversationId;
    try {
      if (!convId) {
        const created = await patientExtendedApi.createAiConversation({ title: userText.slice(0, 45) });
        convId = created?.data?.id || null;
        if (convId) setActiveConversationId(convId);
      }
      if (convId) {
        await patientExtendedApi.postAiMessage(convId, 'user', userText);
      }
    } catch {}

    setTimeout(async () => {
      setIsTyping(false);
      const generated = generateDemoAIResponse(userText, settings.responseStyle, settings.language);
      const aiMsg: ChatMessage = {
        id: `MSG-${Date.now()}-AI`,
        sender: 'ai',
        content: generated.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: generated.questions,
        isEmergencyAlert: generated.isEmergency
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      if (convId) {
        await patientExtendedApi.postAiMessage(convId, 'assistant', generated.content).catch(() => {});
        await loadAiData();
      }
    }, 600);
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      setMessages([]);
      setActiveConversationId(null);
      showToast('✓ Started new conversation');
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('✓ Copied to clipboard');
  };

  const handleSaveToNotes = async (msg: ChatMessage) => {
    try {
      await patientExtendedApi.createSavedHealthNote({
        title: msg.content.slice(0, 40) + '...',
        content: msg.content,
        category: 'AI Insight',
      });
      await loadAiData();
      setMessages(messages.map((m) => (m.id === msg.id ? { ...m, savedToNotes: true } : m)));
      showToast('✓ Saved to Health Notes in MySQL');
    } catch {
      showToast('Failed to save health note');
    }
  };

  const handleSaveDoctorQuestions = async (title: string, questions: string[]) => {
    try {
      await patientExtendedApi.createSavedHealthNote({
        title,
        content: questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
        category: 'Doctor Prep',
      });
      await loadAiData();
      showToast('✓ Saved doctor question checklist to MySQL');
    } catch {}
  };

  const handleSaveTip = async (tip: HealthTipItem) => {
    try {
      await patientExtendedApi.createSavedHealthNote({
        title: `Tip: ${tip.category}`,
        content: tip.tip,
        category: tip.category,
      });
      await loadAiData();
      showToast('✓ Saved health tip to MySQL');
    } catch {}
  };

  const handleFeedback = (msgId: string, isHelpful: boolean) => {
    setMessages(messages.map((m) => (m.id === msgId ? { ...m, isHelpful } : m)));
    showToast('✓ Thanks for your feedback');
  };

  const handleRegenerate = () => {
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
      if (lastUserMsg) {
        handleSendMessage(lastUserMsg.content);
      }
    }
  };

  const handleExportChat = (format: 'txt' | 'json' | 'pdf') => {
    const content = format === 'json'
      ? JSON.stringify(messages, null, 2)
      : messages.map((m) => `[${m.timestamp}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MediCare_AI_Chat_Export.${format}`;
    link.click();
    showToast(`✓ Exported chat conversation (${format.toUpperCase()})`);
  };

  const handleClearAIData = async () => {
    try {
      await Promise.all([
        ...chatHistory.map((c) => patientExtendedApi.deleteAiConversation(c.id).catch(() => {})),
        ...savedNotes.map((n) => patientExtendedApi.deleteSavedHealthNote(n.id).catch(() => {})),
        profileApi.updatePreferences({
          health: { ...cachedHealthPrefs, aiSettings: DEFAULT_AI_SETTINGS },
        }).catch(() => {}),
      ]);
      setMessages([]);
      setActiveConversationId(null);
      setChatHistory([]);
      setSavedNotes([]);
      setSettings(DEFAULT_AI_SETTINGS);
      setCachedHealthPrefs((prev) => ({ ...prev, aiSettings: DEFAULT_AI_SETTINGS }));
      showToast('✓ Cleared AI Assistant conversations & notes from database');
    } catch {
      showToast('Failed to clear AI Assistant data');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-24 text-xs font-sans">
      {/* TOAST NOTIFICATION */}
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

      {/* 1. PAGE HEADER & DISCLAIMER */}
      <div className="space-y-3 pb-2">
        <PageHeader
          title={t('ai.title', 'AI Health Assistant')}
          subtitle={t('ai.subtitle', 'Your smart healthcare companion for everyday health guidance and appointment prep.')}
          badgeText={t('ai.badge', 'Demo Assistant Mode')}
          badgeIcon={<ShieldCheck className="w-3.5 h-3.5" />}
          rightElement={
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('more-features')}
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{t('ai.back_to_features', 'Back to Features')}</span>
              </button>
            </div>
          }
        />

        {/* DISCLAIMER BANNER */}
        <div className="p-3 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2 font-mono shadow-sm">
          <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>{t('ai.disclaimer', 'This AI assistant provides general health information and is not a substitute for a qualified healthcare professional.')}</span>
        </div>
      </div>

      {/* 2. 3-COLUMN DESKTOP / RESPONSIVE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT COLUMN: AI ASSISTANT SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <AIAssistantProfileSidebar
            onNewChat={handleNewChat}
            onOpenSavedNotes={() => setSavedNotesModalOpen(true)}
            topics={HEALTH_TOPICS_DATABASE}
            onSelectTopic={(t) => setSelectedTopic(t)}
          />
        </div>

        {/* CENTER COLUMN: MAIN CHAT CONVERSATION AREA */}
        <div className="lg:col-span-2">
          <AIChatArea
            messages={messages}
            isTyping={isTyping}
            onSendMessage={handleSendMessage}
            onOpenHistory={() => setHistoryDrawerOpen(true)}
            onOpenSettings={() => setSettingsDrawerOpen(true)}
            onOpenDoctorPrep={() => setDoctorPrepOpen(true)}
            onOpenTermExplainer={() => setTermExplainerOpen(true)}
            onCopyMessage={handleCopyText}
            onSaveToNotes={handleSaveToNotes}
            onFeedback={handleFeedback}
            onRegenerate={handleRegenerate}
            onNavigateSOS={() => onNavigate('emergency')}
            onNavigateHospitals={() => onNavigate('hospitals')}
          />
        </div>

        {/* RIGHT COLUMN: HEALTH SNAPSHOT & INSIGHTS PANEL */}
        <div className="lg:col-span-1">
          <HealthSnapshotInsightsPanel
            onNavigate={onNavigate}
            onSaveTip={handleSaveTip}
          />
        </div>
      </div>

      {/* MODALS & DRAWERS */}
      <DoctorVisitPrepModal
        isOpen={doctorPrepOpen}
        onClose={() => setDoctorPrepOpen(false)}
        onSaveQuestionsNote={handleSaveDoctorQuestions}
        onCopyText={handleCopyText}
      />

      <MedicalTermExplainerModal
        isOpen={termExplainerOpen}
        onClose={() => setTermExplainerOpen(false)}
        onSelectTermQuery={handleSendMessage}
      />

      <HealthTopicDrawer
        topic={selectedTopic}
        isOpen={!!selectedTopic}
        onClose={() => setSelectedTopic(null)}
        onAskTopic={handleSendMessage}
      />

      <ChatHistoryDrawer
        history={chatHistory}
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        onSelectConversation={(conv) => {
          setActiveConversationId(conv.id);
          setMessages(conv.messages);
        }}
        onDeleteConversation={async (id) => {
          try {
            await patientExtendedApi.deleteAiConversation(id);
            setChatHistory((prev) => prev.filter((c) => c.id !== id));
            if (activeConversationId === id) {
              setActiveConversationId(null);
              setMessages([]);
            }
            showToast('✓ Conversation deleted from database');
          } catch {
            showToast('Failed to delete conversation');
          }
        }}
      />

      <SavedHealthNotesModal
        notes={savedNotes}
        isOpen={savedNotesModalOpen}
        onClose={() => setSavedNotesModalOpen(false)}
        onDeleteNote={async (id) => {
          try {
            await patientExtendedApi.deleteSavedHealthNote(id);
            setSavedNotes((prev) => prev.filter((n) => n.id !== id));
            showToast('✓ Saved note deleted from database');
          } catch {
            showToast('Failed to delete saved note');
          }
        }}
        onCopyNote={handleCopyText}
      />

      <AIChatSettingsDrawer
        settings={settings}
        isOpen={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
        onUpdateSettings={async (newS) => {
          setSettings(newS);
          const nextHealth = { ...cachedHealthPrefs, aiSettings: newS };
          setCachedHealthPrefs(nextHealth);
          try {
            await profileApi.updatePreferences({ health: nextHealth });
            showToast(`✓ AI Settings saved: ${newS.responseStyle} (${newS.language})`);
          } catch {
            showToast('Failed to save AI settings');
          }

          // Instantly update current AI message in newly selected style
          if (messages.length > 0) {
            const lastUserIndex = messages.map(m => m.sender).lastIndexOf('user');
            if (lastUserIndex !== -1) {
              const userText = messages[lastUserIndex].content;
              const regenerated = generateDemoAIResponse(userText, newS.responseStyle, newS.language);
              const updatedMessages = messages.map((m, idx) => {
                if (idx === lastUserIndex + 1 && m.sender === 'ai') {
                  return {
                    ...m,
                    content: regenerated.content,
                    suggestedQuestions: regenerated.questions,
                    isEmergencyAlert: regenerated.isEmergency
                  };
                }
                return m;
              });
              setMessages(updatedMessages);
            }
          }
        }}
        onExportChat={handleExportChat}
        onClearAIData={handleClearAIData}
      />
    </div>
  );
};
