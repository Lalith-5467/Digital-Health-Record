import { socketService, type VideoConsultationCallPayload } from './socketService';
import { apiClient } from './apiClient';

export interface TeleConsultationCallSession {
  sessionId: string;
  consultationId?: string;
  roomId?: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  doctorId: string;
  doctorName: string;
  doctorSpeciality?: string;
  doctorAvatar?: string;
  status: 'calling' | 'connected' | 'rejected' | 'ended';
  startedAt: number;
}

export interface CallChatMessage {
  id: string;
  sender: 'Doctor' | 'Patient';
  senderName: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

const CHANNEL_NAME = 'medicare_teleconsult_broadcast_channel';

type CallListener = (session: TeleConsultationCallSession | null) => void;
type ChatListener = (messages: CallChatMessage[]) => void;

function mapDbMessage(m: any): CallChatMessage {
  const role = String(m.senderRole || '').toUpperCase();
  return {
    id: m.id,
    sender: role === 'DOCTOR' ? 'Doctor' : 'Patient',
    senderName: m.senderName || (role === 'DOCTOR' ? 'Doctor' : 'Patient'),
    text: m.text || '',
    timestamp: m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isRead: true,
  };
}

class TeleConsultationService {
  private listeners: Set<CallListener> = new Set();
  private chatListeners: Set<ChatListener> = new Set();
  private channel: BroadcastChannel | null = null;
  private activeSession: TeleConsultationCallSession | null = null;
  private chatMessages: CallChatMessage[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Cross-tab BroadcastChannel for real-time in-browser tab sync (ephemeral, no localStorage persistence)
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event) => {
            if (event.data?.type === 'CALL_SESSION_UPDATE') {
              this.activeSession = event.data.session;
              this.notify(this.activeSession);
            } else if (event.data?.type === 'CHAT_MESSAGES_UPDATE') {
              this.chatMessages = Array.isArray(event.data.messages) ? event.data.messages : [];
              this.notifyChat(this.chatMessages);
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel not supported or error:', e);
        }
      }

      // 2. Socket.IO Real-Time Video Call Event Listener
      try {
        socketService.subscribeToVideoCallEvents((payload: VideoConsultationCallPayload) => {
          this.handleSocketCallEvent(payload);
        });

        // 3. Socket.IO Real-Time Video Consultation Chat Listener
        socketService.onConsultationChatMessage((data) => {
          if (data?.message) {
            this.receiveSocketChatMessage(data.message);
          }
        });
      } catch (e) {
        console.warn('SocketService video call subscription error:', e);
      }
    }
  }

  private handleSocketCallEvent(payload: VideoConsultationCallPayload) {
    if (payload.event === 'call:incoming') {
      const consultation = payload.consultation;
      const session: TeleConsultationCallSession = {
        sessionId: payload.consultationId,
        consultationId: payload.consultationId,
        roomId: payload.roomId || undefined,
        appointmentId: `APT-${payload.consultationId.slice(-5).toUpperCase()}`,
        patientId: payload.patientId,
        patientName: consultation?.patient?.fullName || 'Patient',
        patientAvatar: consultation?.patient?.avatar || undefined,
        doctorId: payload.doctorId,
        doctorName: consultation?.doctor?.fullName || 'Doctor',
        doctorSpeciality: consultation?.doctor?.speciality || undefined,
        status: 'calling',
        startedAt: Date.now(),
      };
      this.activeSession = session;
      this.broadcastSession(session);
      this.loadChatMessages(payload.consultationId).catch(() => {});
    } else if (payload.event === 'call:accepted') {
      const current = this.activeSession;
      if (current && (current.consultationId === payload.consultationId || current.sessionId === payload.consultationId)) {
        const updated: TeleConsultationCallSession = {
          ...current,
          roomId: payload.roomId || current.roomId,
          status: 'connected',
        };
        this.activeSession = updated;
        this.broadcastSession(updated);
      }
    } else if (payload.event === 'call:declined') {
      const current = this.activeSession;
      if (current && (current.consultationId === payload.consultationId || current.sessionId === payload.consultationId)) {
        const updated: TeleConsultationCallSession = {
          ...current,
          status: 'rejected',
        };
        this.activeSession = updated;
        this.broadcastSession(updated);
        setTimeout(() => {
          this.activeSession = null;
          this.broadcastSession(null);
        }, 800);
      }
    } else if (payload.event === 'call:cancelled' || payload.event === 'call:ended') {
      const current = this.activeSession;
      if (current && (current.consultationId === payload.consultationId || current.sessionId === payload.consultationId)) {
        const updated: TeleConsultationCallSession = {
          ...current,
          status: 'ended',
        };
        this.activeSession = updated;
        this.broadcastSession(updated);
        setTimeout(() => {
          this.activeSession = null;
          this.chatMessages = [];
          this.broadcastSession(null);
          this.broadcastChat([]);
        }, 800);
      }
    }
  }

  public getActiveSession(): TeleConsultationCallSession | null {
    return this.activeSession;
  }

  public async loadChatMessages(consultationId?: string): Promise<CallChatMessage[]> {
    const targetId = consultationId || this.activeSession?.consultationId;
    if (!targetId) return this.chatMessages;
    try {
      const res = await apiClient.get<any[]>(`/video-consultations/${targetId}/messages`);
      if (res && Array.isArray(res.data)) {
        const mapped = res.data.map(mapDbMessage);
        this.chatMessages = mapped;
        this.broadcastChat(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch persisted consultation messages:', err);
    }
    return this.chatMessages;
  }

  public initiateCall(params: {
    consultationId?: string;
    roomId?: string;
    patientId: string;
    patientName: string;
    patientAvatar?: string;
    doctorId: string;
    doctorName: string;
    doctorSpeciality?: string;
    doctorAvatar?: string;
  }): TeleConsultationCallSession {
    const session: TeleConsultationCallSession = {
      sessionId: params.consultationId || `CALL-${Date.now()}`,
      consultationId: params.consultationId,
      roomId: params.roomId,
      appointmentId: `APT-${(params.consultationId || Date.now().toString()).slice(-5).toUpperCase()}`,
      patientId: params.patientId,
      patientName: params.patientName,
      patientAvatar: params.patientAvatar,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      doctorSpeciality: params.doctorSpeciality,
      doctorAvatar: params.doctorAvatar,
      status: 'calling',
      startedAt: Date.now(),
    };

    this.activeSession = session;
    this.chatMessages = [];
    this.broadcastSession(session);
    this.broadcastChat([]);

    if (params.consultationId) {
      this.loadChatMessages(params.consultationId).catch(() => {});
    }

    return session;
  }

  public acceptCall(): TeleConsultationCallSession | null {
    if (!this.activeSession) return null;

    const updated: TeleConsultationCallSession = {
      ...this.activeSession,
      status: 'connected',
    };

    this.activeSession = updated;
    this.broadcastSession(updated);
    if (updated.consultationId) {
      this.loadChatMessages(updated.consultationId).catch(() => {});
    }
    return updated;
  }

  public rejectCall(): void {
    if (this.activeSession) {
      const updated: TeleConsultationCallSession = {
        ...this.activeSession,
        status: 'rejected',
      };
      this.activeSession = updated;
      this.broadcastSession(updated);
    }
    setTimeout(() => {
      this.activeSession = null;
      this.broadcastSession(null);
    }, 500);
  }

  public endCall(): void {
    if (this.activeSession) {
      const updated: TeleConsultationCallSession = {
        ...this.activeSession,
        status: 'ended',
      };
      this.activeSession = updated;
      this.broadcastSession(updated);
    }
    setTimeout(() => {
      this.activeSession = null;
      this.chatMessages = [];
      this.broadcastSession(null);
      this.broadcastChat([]);
    }, 500);
  }

  public getChatMessages(): CallChatMessage[] {
    return this.chatMessages;
  }

  public receiveSocketChatMessage(msg: CallChatMessage): void {
    if (this.chatMessages.some((m) => m.id === msg.id)) {
      return;
    }
    this.chatMessages = [...this.chatMessages, msg];
    this.broadcastChat(this.chatMessages);
  }

  public sendChatMessage(
    sender: 'Doctor' | 'Patient',
    senderName: string,
    text: string,
    consultationIdOverride?: string
  ): CallChatMessage {
    const tempId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: CallChatMessage = {
      id: tempId,
      sender,
      senderName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
    };

    this.chatMessages = [...this.chatMessages, newMsg];
    this.broadcastChat(this.chatMessages);

    const targetConsultationId = consultationIdOverride || this.activeSession?.consultationId;

    if (targetConsultationId) {
      // Relay over Socket.IO to remote participant
      socketService.sendConsultationChatMessage(targetConsultationId, newMsg);

      // Persist message to MySQL via backend API
      apiClient
        .post<any>(`/video-consultations/${targetConsultationId}/messages`, {
          text,
          senderName,
        })
        .then((res) => {
          if (res?.data?.id) {
            const persisted = mapDbMessage(res.data);
            this.chatMessages = this.chatMessages.map((m) => (m.id === tempId ? persisted : m));
            this.broadcastChat(this.chatMessages);
          }
        })
        .catch((err) => {
          console.error('Failed to persist consultation chat message to MySQL:', err);
        });
    }

    return newMsg;
  }

  public subscribe(cb: CallListener): () => void {
    this.listeners.add(cb);
    cb(this.activeSession);
    return () => this.listeners.delete(cb);
  }

  public subscribeChat(cb: ChatListener): () => void {
    this.chatListeners.add(cb);
    cb(this.chatMessages);
    if (this.activeSession?.consultationId) {
      this.loadChatMessages(this.activeSession.consultationId).catch(() => {});
    }
    return () => this.chatListeners.delete(cb);
  }

  private broadcastSession(session: TeleConsultationCallSession | null) {
    this.notify(session);
    try {
      this.channel?.postMessage({ type: 'CALL_SESSION_UPDATE', session });
    } catch (e) {
      console.warn('Channel post error:', e);
    }
  }

  private broadcastChat(messages: CallChatMessage[]) {
    this.notifyChat(messages);
    try {
      this.channel?.postMessage({ type: 'CHAT_MESSAGES_UPDATE', messages });
    } catch (e) {
      console.warn('Channel post error:', e);
    }
  }

  private notify(session: TeleConsultationCallSession | null) {
    this.listeners.forEach((fn) => {
      try {
        fn(session);
      } catch (err) {
        console.error('TeleConsultationService notification error:', err);
      }
    });
  }

  private notifyChat(messages: CallChatMessage[]) {
    this.chatListeners.forEach((fn) => {
      try {
        fn(messages);
      } catch (err) {
        console.error('TeleConsultationService chat notification error:', err);
      }
    });
  }
}

export const teleConsultationService = new TeleConsultationService();
