import React, { useState, useEffect, useMemo } from 'react';
import type { ConsultationAppointment } from '../../consultation/consultationData';
import { PreCallScreen } from '../../consultation/PreCallScreen';
import { WaitingRoom } from '../../consultation/WaitingRoom';
import { ActiveConsultationRoom } from '../../consultation/ActiveConsultationRoom';
import { ConsultationEndedScreen } from '../../consultation/ConsultationEndedScreen';
import { DeviceSettingsDrawer } from '../../consultation/DeviceSettingsDrawer';
import { TechnicalIssueModal } from '../../consultation/TechnicalIssueModal';
import { ConfirmLeaveModal } from '../../consultation/ConfirmLeaveModal';
import { teleConsultationService } from '../../../services/teleConsultationService';
import { videoConsultationApi, type VideoConsultationResponse } from '../../../services/videoConsultationApi';
import { profileApi, recordApi } from '../../../services/dhrApis';

interface DoctorVideoConsultationViewProps {
  user?: { name: string; email: string };
  patientId?: string | null;
  onNavigate: (page: string) => void;
}

export const DoctorVideoConsultationView: React.FC<DoctorVideoConsultationViewProps> = ({
  user,
  patientId: _patientId,
  onNavigate,
}) => {
  // WORKFLOW STAGES: 'preCall' | 'waiting' | 'active' | 'ended'
  const [stage, setStage] = useState<'preCall' | 'waiting' | 'active' | 'ended'>('active');

  const [activeCall, setActiveCall] = useState(teleConsultationService.getActiveSession());
  const [activeConsultation, setActiveConsultation] = useState<VideoConsultationResponse | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  // Synchronize latest active consultation session and doctor profile from backend
  useEffect(() => {
    let isMounted = true;

    profileApi
      .getDoctorProfile()
      .then((res) => {
        if (isMounted && res?.data) {
          setDoctorProfile(res.data);
        }
      })
      .catch(() => {});

    const syncActiveConsultation = async () => {
      try {
        const res = await videoConsultationApi.getDoctorRequests();
        if (!isMounted) return;

        const activeItem = res?.find(
          (r: any) => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS' || r.status === 'WAITING_FOR_DOCTOR'
        );

        if (activeItem) {
          setActiveConsultation(activeItem);
          const session = {
            sessionId: activeItem.id,
            consultationId: activeItem.id,
            roomId: activeItem.roomId || undefined,
            appointmentId: `APT-${activeItem.id.slice(-5).toUpperCase()}`,
            patientId: activeItem.patientId,
            patientName: activeItem.patient?.fullName || 'Patient',
            patientAvatar: activeItem.patient?.avatar || undefined,
            doctorId: activeItem.doctorId,
            doctorName: activeItem.doctor?.fullName || user?.name || 'Doctor',
            doctorSpeciality: activeItem.doctor?.speciality || undefined,
            status: 'connected' as const,
            startedAt: Date.now(),
          };
          teleConsultationService.initiateCall(session);
          setActiveCall(session);
          return;
        }

        const latest = teleConsultationService.getActiveSession();
        if (latest?.consultationId) {
          setActiveCall(latest);
        }
      } catch (err) {
        console.warn('Error fetching active consultation for doctor:', err);
      }
    };

    syncActiveConsultation();

    // When doctor views this room, ensure session is set to connected
    teleConsultationService.acceptCall();

    const unsubscribe = teleConsultationService.subscribe((session) => {
      if (session) {
        setActiveCall(session);
        if (session.status === 'ended') {
          setStage('ended');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.name]);

  const resolvedDoctorName = useMemo(() => {
    const raw = doctorProfile?.fullName || activeCall?.doctorName || user?.name || 'Attending Physician';
    return raw.startsWith('Dr') || raw === 'Attending Physician' ? raw : `Dr. ${raw}`;
  }, [doctorProfile?.fullName, activeCall?.doctorName, user?.name]);

  const appointment: ConsultationAppointment = useMemo(
    () => ({
      id: activeCall?.appointmentId || activeConsultation?.id || 'LIVE-CONSULT',
      doctor: {
        id: doctorProfile?.id || activeCall?.doctorId || 'DOCTOR',
        name: resolvedDoctorName,
        speciality: doctorProfile?.speciality || activeCall?.doctorSpeciality || 'General Medicine',
        rating: 0,
        experienceYears: Number(doctorProfile?.experienceYears || 0),
        languages: ['English'],
        hospital: doctorProfile?.hospital || 'Clinical Practice',
        avatarUrl: doctorProfile?.photoUrl || activeCall?.doctorAvatar || '',
        bio: doctorProfile?.about || 'Digital Health Tele-Consultation Session',
      },
      date: 'Today · Live Session',
      time: 'In Progress',
      type: 'Video Consultation',
      status: 'In Progress',
      reason: activeConsultation?.reason || 'Tele-consultation, vitals review & digital prescription',
    }),
    [activeCall, activeConsultation, doctorProfile, resolvedDoctorName]
  );

  // DEVICE STATES
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  // ENDED CALL METRICS
  const [endedDurationSeconds, setEndedDurationSeconds] = useState(0);
  const [finalNotesText, setFinalNotesText] = useState('');

  // MODAL STATES
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [technicalIssueOpen, setTechnicalIssueOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [_leaveModalType, setLeaveModalType] = useState<'waiting' | 'active'>('waiting');

  const patientName = activeConsultation?.patient?.fullName || activeCall?.patientName || 'Patient';
  const patientAvatar = activeConsultation?.patient?.avatar || activeCall?.patientAvatar || '';

  const handleEndCallConfirmed = async (durationSeconds: number, notesText: string) => {
    setEndedDurationSeconds(durationSeconds);
    setFinalNotesText(notesText);

    const consultationId = activeCall?.consultationId || activeConsultation?.id;
    if (consultationId) {
      await videoConsultationApi.endConsultation(consultationId).catch(console.error);
    }
    teleConsultationService.endCall();

    try {
      const targetPatientId = activeConsultation?.patientId || activeCall?.patientId;
      if (targetPatientId) {
        await recordApi.createMedicalRecord({
          patientId: targetPatientId,
          title: `Doctor Tele-Consultation Summary - ${patientName}`,
          type: 'CONSULTATION',
          hospital: appointment.doctor.hospital,
          status: 'Reviewed',
          notes: notesText || `Doctor video consultation with ${patientName} (${durationSeconds}s) completed.`,
        });
      }
    } catch (e) {
      console.error('Failed to persist consultation record to database:', e);
    }

    setStage('ended');
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50 dark:bg-[#070c18] text-slate-900 dark:text-white select-none transition-colors duration-300 font-sans pb-16">
      {/* 1. PRE-CALL STAGE */}
      {stage === 'preCall' && (
        <div className="p-3 sm:p-6 max-w-6xl mx-auto">
          <PreCallScreen
            appointment={appointment}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            speakerEnabled={speakerEnabled}
            onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
            onToggleMic={() => setMicEnabled(!micEnabled)}
            onToggleSpeaker={() => setSpeakerEnabled(!speakerEnabled)}
            onOpenDeviceSettings={() => setDeviceSettingsOpen(true)}
            onJoinWaitingRoom={() => setStage('active')}
            onNavigateAppointments={() => onNavigate('appointments')}
          />
        </div>
      )}

      {/* 2. WAITING ROOM STAGE */}
      {stage === 'waiting' && (
        <div className="p-3 sm:p-6 max-w-2xl mx-auto">
          <WaitingRoom
            appointment={appointment}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
            onToggleMic={() => setMicEnabled(!micEnabled)}
            onLeaveWaitingRoom={() => {
              teleConsultationService.rejectCall();
              setLeaveModalType('waiting');
              setConfirmLeaveOpen(true);
            }}
            onDoctorJoined={() => setStage('active')}
          />
        </div>
      )}

      {/* 3. ACTIVE CONSULTATION ROOM STAGE */}
      {stage === 'active' && (
        <ActiveConsultationRoom
          appointment={appointment}
          cameraEnabled={cameraEnabled}
          micEnabled={micEnabled}
          speakerEnabled={speakerEnabled}
          onToggleCamera={() => setCameraEnabled(!cameraEnabled)}
          onToggleMic={() => setMicEnabled(!micEnabled)}
          onToggleSpeaker={() => setSpeakerEnabled(!speakerEnabled)}
          onOpenReportIssue={() => setTechnicalIssueOpen(true)}
          onOpenDeviceSettings={() => setDeviceSettingsOpen(true)}
          onEndCall={(dur, notes) => {
            setEndedDurationSeconds(dur);
            setFinalNotesText(notes);
            setLeaveModalType('active');
            setConfirmLeaveOpen(true);
          }}
          onNavigateRecords={() => onNavigate('prescriptions')}
          currentRole="Doctor"
          currentUserName={appointment.doctor.name}
          remoteUserName={patientName}
          remoteUserAvatar={patientAvatar}
          remoteUserRoleTitle={`Patient · ${patientName}`}
        />
      )}

      {/* 4. CONSULTATION ENDED STAGE */}
      {stage === 'ended' && (
        <div className="p-3 sm:p-6 max-w-2xl mx-auto">
          <ConsultationEndedScreen
            appointment={appointment}
            durationSeconds={endedDurationSeconds}
            notesText={finalNotesText}
            onNavigateRecords={() => onNavigate('prescriptions')}
            onNavigateAppointments={() => onNavigate('appointments')}
            onNavigateDashboard={() => onNavigate('overview')}
          />
        </div>
      )}

      {/* MODALS */}
      <DeviceSettingsDrawer
        isOpen={deviceSettingsOpen}
        onClose={() => setDeviceSettingsOpen(false)}
      />

      <TechnicalIssueModal
        isOpen={technicalIssueOpen}
        onClose={() => setTechnicalIssueOpen(false)}
        onSubmitted={() => { }}
      />

      <ConfirmLeaveModal
        isOpen={confirmLeaveOpen}
        title="End Video Consultation Session?"
        message="Are you sure you want to exit? Your clinical consultation notes and conversation log will be safely recorded."
        confirmLabel="Exit & Save Session"
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={() => handleEndCallConfirmed(endedDurationSeconds, finalNotesText)}
      />
    </div>
  );
};
