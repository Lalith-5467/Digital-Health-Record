import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HeartHandshake, 
  User, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Calendar, 
  Truck, 
  UserCheck, 
  FileText, 
  X, 
  Activity,
  CheckCircle
} from 'lucide-react';
import { useCaregiverWorkflow } from '../../../utils/caregiverWorkflowStorage';
import { useLanguage } from '../../../context/LanguageContext';
import { getLocalizedName } from '../../../utils/caregiverDataTranslator';
import { caregiverApi, clinicalApi } from '../../../services/dhrApis';

type HomeCareStatus =
  | 'Requested'
  | 'Confirmed'
  | 'Assigned'
  | 'On The Way'
  | 'Arrived'
  | 'Visit Completed'
  | 'Cancelled';

interface HomeCareBookingItem {
  id: string;
  wardId: string;
  dependentName: string;
  serviceType: string;
  careProfessionalName: string;
  role: string;
  specialization: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  address: string;
  status: HomeCareStatus;
  notes: string;
  contactPhone: string;
  otp: string;
  eta: string;
}

// Ordered steps for the tracking timeline
const TIMELINE_STEPS: HomeCareStatus[] = [
  'Requested',
  'Confirmed',
  'Assigned',
  'On The Way',
  'Arrived',
  'Visit Completed'
];

function mapCareRequestStatus(raw: string): HomeCareStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'completed' || s === 'visit completed') return 'Visit Completed';
  if (s === 'on the way' || s === 'en route' || s === 'in transit') return 'On The Way';
  if (s === 'arrived' || s === 'in progress') return 'Arrived';
  if (s === 'accepted' || s === 'assigned') return 'Assigned';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'cancelled' || s === 'rejected') return 'Cancelled';
  return 'Requested';
}

export const CaregiverHomeCareView: React.FC = () => {
  const { t } = useLanguage();
  const { wards, activeWard, setActiveWardId } = useCaregiverWorkflow();

  const [bookingsMap, setBookingsMap] = useState<Record<string, HomeCareBookingItem[]>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!activeWard?.id) return;
    try {
      const res = await caregiverApi.getWardRecords(activeWard.id);
      const raw = res?.data?.careRequests || [];
      const mapped: HomeCareBookingItem[] = raw.map((c: any) => {
        const rawDate = c.scheduledDate || c.prefDate || c.createdAt;
        const formattedDate = rawDate
          ? new Date(rawDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—';
        return {
          id: c.id,
          wardId: activeWard.id,
          dependentName: activeWard.name || c.patient?.fullName || 'Dependent',
          serviceType: c.serviceType || 'Home Nursing Care',
          careProfessionalName: c.nurse?.fullName || 'Pending Nurse Assignment',
          role: c.nurse?.designation || 'Registered Nurse',
          specialization: c.nurse?.department || 'Home Healthcare',
          scheduledDate: formattedDate,
          scheduledTime: c.scheduledTime || c.time || '10:00 AM',
          duration: c.duration || 'Standard Visit',
          address: c.location || c.address || activeWard.currentLocation || 'Patient Residence',
          status: mapCareRequestStatus(c.status),
          notes: c.nurseClinicalNotes || c.instructions || c.notes || '',
          contactPhone: c.nurse?.phone || '—',
          otp: c.otpPin || '—',
          eta: c.etaMinutes ? `${c.etaMinutes} mins` : '—',
        };
      });
      setBookingsMap((prev) => ({ ...prev, [activeWard.id]: mapped }));
    } catch (err) {
      console.error('Failed to load home care bookings from MySQL:', err);
    }
  }, [activeWard?.id, activeWard?.name, activeWard?.currentLocation]);

  useEffect(() => {
    loadBookings();
    const handleSync = () => loadBookings();
    window.addEventListener('medicare_caregiver_sync', handleSync);
    return () => window.removeEventListener('medicare_caregiver_sync', handleSync);
  }, [loadBookings]);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals & Drawers state
  const [selectedDetailBooking, setSelectedDetailBooking] = useState<HomeCareBookingItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Get current dependent's home care bookings
  const currentDependentBookings = useMemo(() => {
    return bookingsMap[activeWard.id] || [];
  }, [bookingsMap, activeWard.id]);

  // Calculate dynamic summary stats for selected dependent
  const stats = useMemo(() => {
    const activeVisits = currentDependentBookings.filter((b) =>
      ['Confirmed', 'Assigned', 'On The Way', 'Arrived'].includes(b.status)
    ).length;
    const completed = currentDependentBookings.filter((b) => b.status === 'Visit Completed').length;
    const requested = currentDependentBookings.filter((b) => b.status === 'Requested').length;
    const cancelled = currentDependentBookings.filter((b) => b.status === 'Cancelled').length;

    return { activeVisits, completed, requested, cancelled, total: currentDependentBookings.length };
  }, [currentDependentBookings]);

  // Filter and search bookings
  const filteredBookings = useMemo(() => {
    return currentDependentBookings.filter((b) => {
      if (statusFilter !== 'All' && b.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          b.careProfessionalName.toLowerCase().includes(q) ||
          b.role.toLowerCase().includes(q) ||
          b.specialization.toLowerCase().includes(q) ||
          b.serviceType.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [currentDependentBookings, statusFilter, searchQuery]);

  // Persisted MySQL Actions via clinicalApi.updateCareRequest
  const handleConfirmArrival = async (id: string, professionalName: string) => {
    setUpdatingId(id);
    try {
      await clinicalApi.updateCareRequest(id, { status: 'Arrived' });
      await loadBookings();
      window.dispatchEvent(new Event('medicare_caregiver_sync'));
      showToast(`${professionalName} ${t('caregiver.home_care.arrived_toast', 'arrival confirmed in database!')}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to confirm arrival on server.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkCompleted = async (id: string, _professionalName: string) => {
    setUpdatingId(id);
    try {
      await clinicalApi.updateCareRequest(id, { status: 'Completed' });
      await loadBookings();
      window.dispatchEvent(new Event('medicare_caregiver_sync'));
      showToast(t('caregiver.home_care.visit_completed_toast', 'Home care visit marked as completed in MySQL.'));
    } catch (err: any) {
      showToast(err?.message || 'Failed to mark visit as completed on server.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelBooking = async (id: string) => {
    setUpdatingId(id);
    try {
      await clinicalApi.updateCareRequest(id, { status: 'Cancelled' });
      await loadBookings();
      window.dispatchEvent(new Event('medicare_caregiver_sync'));
      showToast(t('caregiver.home_care.cancelled_toast', 'Booking cancelled successfully.'));
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel booking on server.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStepIndex = (status: HomeCareStatus) => {
    return TIMELINE_STEPS.indexOf(status);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'On The Way':
      case 'Arrived':
        return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 dark:text-cyan-400 animate-pulse';
      case 'Confirmed':
      case 'Assigned':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400';
      case 'Visit Completed':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
      case 'Cancelled':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className="space-y-6 select-none pb-12">

      {/* TOAST NOTIFICATION */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              className="pointer-events-auto select-auto bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-cyan-500/40 flex items-center gap-3 backdrop-blur-xl"
            >
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold">{toastMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HEADER & DEPENDENT SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
              <span>{t('caregiver.home_care.title', 'Nurse & Home-Care Booking Tracking')}</span>
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-black tracking-wide flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Dispatch
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {t('caregiver.home_care.subtitle', 'Track real-time home-care nurse dispatch, arrival status, and active visits for your selected dependent.')}
          </p>
        </div>

        {/* DEPENDENT SWITCHER */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {wards.map((ward) => (
            <button
              key={ward.id}
              onClick={() => setActiveWardId(ward.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                ward.id === activeWard.id
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60'
              }`}
            >
              <User className="w-3.5 h-3.5 opacity-80" />
              {getLocalizedName(ward.name, t)}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('caregiver.home_care.active_visits', 'Active / Live Visits')}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-cyan-500 dark:text-cyan-400 mt-1">
              {stats.activeVisits}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('caregiver.home_care.completed_visits', 'Completed Visits')}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 mt-1">
              {stats.completed}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('caregiver.home_care.requested', 'Requested')}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-500 dark:text-amber-400 mt-1">
              {stats.requested}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('caregiver.home_care.cancelled', 'Cancelled')}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-rose-500 dark:text-rose-400 mt-1">
              {stats.cancelled}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-3 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('caregiver.home_care.search_placeholder', 'Search nurse, role, service or location...')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold">
          <Filter className="w-3.5 h-3.5 text-cyan-500" />
          <span className="text-slate-500 dark:text-slate-400">{t('caregiver.home_care.filter_status', 'Status')}:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-slate-900 dark:text-white font-black text-xs focus:outline-none cursor-pointer"
          >
            <option value="All" className="bg-slate-900 text-white">{t('caregiver.home_care.all_statuses', 'All Statuses')}</option>
            <option value="Requested" className="bg-slate-900 text-white">Requested</option>
            <option value="Confirmed" className="bg-slate-900 text-white">Confirmed</option>
            <option value="Assigned" className="bg-slate-900 text-white">Assigned</option>
            <option value="On The Way" className="bg-slate-900 text-white">On The Way</option>
            <option value="Arrived" className="bg-slate-900 text-white">Arrived</option>
            <option value="Visit Completed" className="bg-slate-900 text-white">Visit Completed</option>
            <option value="Cancelled" className="bg-slate-900 text-white">Cancelled</option>
          </select>
        </div>
      </div>

      {/* BOOKINGS LIST OR EMPTY STATE */}
      <div className="space-y-4">
        {currentDependentBookings.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
              <HeartHandshake className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {t('caregiver.home_care.no_bookings_found', 'No home-care bookings found for this dependent yet.')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              {t('caregiver.home_care.no_bookings_desc', 'Schedule a verified nurse or home care assistant for daily care or vital checks.')}
            </p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {t('caregiver.home_care.no_matching_search', 'No matching home-care bookings')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
              {t('caregiver.home_care.no_matching_search_desc', 'Try adjusting your search terms or status filters.')}
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const currentStepIdx = getStepIndex(booking.status);
            const isCancelled = booking.status === 'Cancelled';
            const isBusy = updatingId === booking.id;

            return (
              <motion.div
                key={booking.id}
                whileHover={{ y: -2 }}
                className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-all"
              >
                {/* HEADER ROW */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                      <UserCheck className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                          {booking.careProfessionalName}
                        </h3>
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                          {booking.role}
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                        {booking.serviceType} • <span className="text-cyan-600 dark:text-cyan-400">{booking.specialization}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                          {booking.scheduledDate} at {booking.scheduledTime} ({booking.duration})
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          {booking.address}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PERSISTED ACTIONS & DETAIL BUTTON */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                    <button
                      onClick={() => setSelectedDetailBooking(booking)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{t('caregiver.home_care.view_details', 'View Booking Details')}</span>
                    </button>

                    {(booking.status === 'Assigned' || booking.status === 'On The Way' || booking.status === 'Confirmed') && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleConfirmArrival(booking.id, booking.careProfessionalName)}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>{t('caregiver.home_care.confirm_arrival', 'Confirm Arrival')}</span>
                      </button>
                    )}

                    {booking.status === 'Arrived' && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleMarkCompleted(booking.id, booking.careProfessionalName)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t('caregiver.home_care.mark_completed', 'Mark Visit Completed')}</span>
                      </button>
                    )}

                    {!['Visit Completed', 'Cancelled'].includes(booking.status) && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-500/20 transition-all cursor-pointer"
                      >
                        {t('caregiver.home_care.cancel_booking', 'Cancel Booking')}
                      </button>
                    )}
                  </div>
                </div>

                {/* VISUAL TRACKING TIMELINE */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-500" />
                    <span>{t('caregiver.home_care.timeline_title', 'Home-Care Dispatch & Visit Timeline')}</span>
                  </p>

                  {isCancelled ? (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>This home-care booking has been cancelled.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center relative">
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isCompletedStep = currentStepIdx > idx || booking.status === 'Visit Completed';
                        const isCurrentStep = currentStepIdx === idx && booking.status !== 'Visit Completed';

                        return (
                          <div key={step} className="flex flex-col items-center space-y-1.5 z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              isCompletedStep
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400/40'
                                : isCurrentStep
                                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/40 ring-4 ring-cyan-500/20 animate-pulse'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {isCompletedStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                            </div>

                            <span className={`text-[10px] font-bold leading-tight ${
                              isCompletedStep
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isCurrentStep
                                ? 'text-cyan-600 dark:text-cyan-400 font-black'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </motion.div>
            );
          })
        )}
      </div>

      {/* BOOKING DETAILS MODAL */}
      <AnimatePresence>
        {selectedDetailBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" 
              onClick={() => setSelectedDetailBooking(null)} 
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-lg bg-white dark:bg-[#0b1120] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {t('caregiver.home_care.details_title', 'Home-Care Booking Details')}
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                      ID: {selectedDetailBooking.id}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDetailBooking(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block font-semibold">{t('caregiver.home_care.dependent', 'Dependent')}:</span>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {selectedDetailBooking.dependentName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">{t('caregiver.home_care.status', 'Status')}:</span>
                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadgeStyle(selectedDetailBooking.status)}`}>
                      {selectedDetailBooking.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Care Professional:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDetailBooking.careProfessionalName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Professional Role:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{selectedDetailBooking.role}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Specialization:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDetailBooking.specialization}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Service Type:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDetailBooking.serviceType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Date & Time:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDetailBooking.scheduledDate} at {selectedDetailBooking.scheduledTime}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Duration:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDetailBooking.duration}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-400 font-medium">Address:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-right max-w-xs">{selectedDetailBooking.address}</span>
                  </div>
                </div>

                {selectedDetailBooking.notes && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                      Caregiver Instructions / Notes:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 italic">
                      {selectedDetailBooking.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedDetailBooking(null)}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  {t('caregiver.common.close', 'Close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
