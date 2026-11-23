import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Sparkles, AlertCircle } from 'lucide-react';
import type { HospitalItem } from './hospitalsData';
import { appointmentApi } from '../../services/dhrApis';

interface HospitalAppointmentModalProps {
  hospital: HospitalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (hospName: string, dept: string, doc: string, date: string) => void;
}

export const HospitalAppointmentModal: React.FC<HospitalAppointmentModalProps> = ({
  hospital,
  isOpen,
  onClose,
  onConfirmBooking,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState<string>('10:30 AM');
  const [reason, setReason] = useState<string>('Routine health consultation & checkup');
  const [booking, setBooking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !hospital) return;
    let active = true;
    setLoadingDoctors(true);
    setErrorMsg(null);

    appointmentApi
      .getDoctors()
      .then((res) => {
        if (!active) return;
        const allDocs = Array.isArray(res?.data) ? res.data : [];
        const hospNameLower = (hospital.name || '').toLowerCase();
        const matching = allDocs.filter(
          (d: any) => d.hospital && String(d.hospital).toLowerCase().includes(hospNameLower)
        );
        const list = matching.length > 0 ? matching : allDocs;
        setDoctors(list);
        if (list[0]?.id) {
          setSelectedDoctorId(list[0].id);
        } else {
          setSelectedDoctorId('');
        }
      })
      .catch(() => {
        if (active) {
          setDoctors([]);
          setSelectedDoctorId('');
        }
      })
      .finally(() => {
        if (active) setLoadingDoctors(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, hospital]);

  if (!isOpen || !hospital) return null;

  const activeDept = selectedDept || (hospital.specialties[0] || 'General Medicine');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setErrorMsg('No registered doctor is available for booking right now.');
      return;
    }
    setBooking(true);
    setErrorMsg(null);

    try {
      await appointmentApi.createAppointment({
        doctorId: selectedDoctorId,
        appointmentDate: preferredDate,
        slotTime: preferredTime,
        type: 'IN_PERSON',
        reason: reason.trim() || `${activeDept} consultation at ${hospital.name}`,
        notes: `Hospital: ${hospital.name} | Department: ${activeDept}`,
      });
      const chosenDoc = doctors.find((d) => d.id === selectedDoctorId);
      onConfirmBooking(hospital.name, activeDept, chosenDoc?.fullName || 'Doctor', preferredDate);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to book appointment. Please try another slot.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 dark:bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative text-slate-900 dark:text-white">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00a896]/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Book Appointment</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{hospital.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider mb-1.5">Department</label>
            <select
              value={activeDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-[#00a896]"
            >
              {hospital.specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider mb-1.5">Select Doctor</label>
            {loadingDoctors ? (
              <div className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs">
                Loading registered doctors...
              </div>
            ) : doctors.length === 0 ? (
              <div className="w-full px-3 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium">
                No registered doctors available in the database yet.
              </div>
            ) : (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-[#00a896]"
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.fullName} {doc.speciality ? `(${doc.speciality})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider mb-1.5">Date</label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-[#00a896]"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider mb-1.5">Time</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-[#00a896]"
              >
                <option value="09:30 AM">09:30 AM</option>
                <option value="10:30 AM">10:30 AM</option>
                <option value="02:15 PM">02:15 PM</option>
                <option value="05:00 PM">05:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider mb-1.5">Reason for Visit</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:border-[#00a896]"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={booking || !selectedDoctorId}
              className="flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-[#00a896] to-cyan-600 hover:from-teal-600 hover:to-cyan-500 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {booking ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Booking Appointment...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm Appointment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
