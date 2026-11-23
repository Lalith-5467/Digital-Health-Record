import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, MapPin, Phone, ShieldCheck, Search, X, CheckCircle2, 
  Map, Star, Activity, PlusCircle, AlertCircle, Bookmark, ChevronLeft, ChevronRight, Stethoscope
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { insuranceApi } from '../../../services/dhrApis';

type Hospital = {
  id: string;
  name: string;
  location: string;
  fullAddress: string;
  type: string;
  status: 'Active' | 'Inactive' | 'Under Review';
  cashlessAvailable: boolean;
  specialties: string[];
  tpa: string[];
  cashlessServices: string[];
  phone: string;
  rating: string;
  lastVerified: string;
};

export const NetworkHospitalsView: React.FC = () => {
  const { t } = useLanguage();
  const [HOSPITALS, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    insuranceApi
      .getNetworkHospitals()
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setHospitals(
            res.data.map((h: any) => {
              let parsedDepts: string[] = ['General Medicine', 'Emergency'];
              if (h.departments) {
                try {
                  const arr = typeof h.departments === 'string' ? JSON.parse(h.departments) : h.departments;
                  if (Array.isArray(arr) && arr.length > 0) parsedDepts = arr;
                } catch {}
              }
              const rawStatus = String(h.status || '').toUpperCase();
              const status: Hospital['status'] =
                rawStatus === 'ACTIVE' ? 'Active' : rawStatus === 'SUSPENDED' || rawStatus === 'REJECTED' ? 'Inactive' : 'Under Review';
              return {
                id: h.code || h.id,
                name: h.name,
                location: [h.city, h.state].filter(Boolean).join(', ') || 'Not Recorded',
                fullAddress: h.address || [h.city, h.state].filter(Boolean).join(', ') || 'Not Recorded',
                type: h.accreditation || h.type || 'Multi-Specialty Hospital',
                status,
                cashlessAvailable: status === 'Active',
                specialties: parsedDepts,
                tpa: ['MediCare TPA'],
                cashlessServices: ['Admission', 'Surgery', 'Emergency', 'Diagnostics'],
                phone: h.contactPhone || 'Not Recorded',
                rating: h.rating ? String(h.rating) : '—',
                lastVerified: h.updatedAt ? new Date(h.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Recorded',
              };
            })
          );
        }
      })
      .catch(() => setHospitals([]));
  }, []);

  const totalHospitals = HOSPITALS.length;
  const cashlessCount = HOSPITALS.filter((h) => h.cashlessAvailable).length;
  const citiesList = React.useMemo(() => {
    const set = new Set<string>();
    HOSPITALS.forEach((h) => {
      const city = h.location.split(',')[0]?.trim();
      if (city && city !== 'Not Recorded') set.add(city);
    });
    return Array.from(set).sort();
  }, [HOSPITALS]);
  const activePct = totalHospitals > 0 ? Math.round((HOSPITALS.filter((h) => h.status === 'Active').length / totalHospitals) * 100) : 0;
  
  // Draft states (bound to inputs)
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cashlessOnly, setCashlessOnly] = useState(false);

  // Applied states (used for filtering)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedLocation, setAppliedLocation] = useState('');
  const [appliedType, setAppliedType] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedCashless, setAppliedCashless] = useState(false);

  const filteredHospitals = HOSPITALS.filter(h => {
    if (appliedSearch && !h.name.toLowerCase().includes(appliedSearch.toLowerCase())) return false;
    if (appliedLocation && !h.location.toLowerCase().includes(appliedLocation.toLowerCase())) return false;
    if (appliedType && !h.type.toLowerCase().includes(appliedType.toLowerCase())) return false;
    if (appliedStatus && h.status.toLowerCase() !== appliedStatus.toLowerCase()) return false;
    if (appliedCashless && !h.cashlessAvailable) return false;
    return true;
  });

  const applyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedLocation(locationFilter);
    setAppliedType(typeFilter);
    setAppliedStatus(statusFilter);
    setAppliedCashless(cashlessOnly);
  };

  const clearFilters = () => {
    // Clear draft states
    setSearchQuery('');
    setLocationFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setCashlessOnly(false);
    
    // Clear applied states
    setAppliedSearch('');
    setAppliedLocation('');
    setAppliedType('');
    setAppliedStatus('');
    setAppliedCashless(false);
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      
      {/* 1. PAGE HEADER & SUMMARY */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('Network Hospitals')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {t('Search and manage hospitals available within the MediCare cashless network.')}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('Network Hospitals')}</p>
          <p className="text-2xl font-black text-blue-600 dark:text-cyan-400">{totalHospitals.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('Cashless Enabled')}</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{cashlessCount.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('Cities Covered')}</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{citiesList.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{t('Active Network')}</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{activePct}%</p>
        </div>
      </div>

      {/* 2. SEARCH & FILTERS CARD */}
      <section className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Hospitals..." 
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/50 outline-none text-slate-900 dark:text-white transition-all"
            />
          </div>

          <select 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">Location / City (All)</option>
            {citiesList.map((city) => (
              <option key={city} value={city.toLowerCase()}>{city}</option>
            ))}
          </select>

          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">Hospital Type</option>
            <option value="multi-specialty">Multi-Specialty</option>
            <option value="general">General</option>
            <option value="specialty">Specialty</option>
            <option value="clinic">Clinic</option>
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">Network Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="under review">Under Review</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer group" onClick={() => setCashlessOnly(!cashlessOnly)}>
            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${cashlessOnly ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Cashless Availability Only</span>
          </label>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={clearFilters}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
            <button 
              onClick={applyFilters}
              className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </section>

      {/* 3. RESULTS CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Showing <span className="text-slate-900 dark:text-white">{filteredHospitals.length > 0 ? 1 : 0} - {filteredHospitals.length}</span> of {filteredHospitals.length} Results
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sort by:</span>
          <select className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none">
            <option>Relevance</option>
            <option>Distance</option>
            <option>Rating</option>
            <option>Recently Updated</option>
          </select>
        </div>
      </div>

      {/* 4. HOSPITAL RESULTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredHospitals.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 font-bold">
            No hospitals found matching your criteria.
          </div>
        ) : (
          filteredHospitals.map((hospital, i) => (
            <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={hospital.id} 
            className="bg-white dark:bg-[#0b1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-800 transition-colors flex flex-col"
          >
            <div className="p-5 sm:p-6 flex-1">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-xl font-black text-blue-600 dark:text-cyan-400 shrink-0">
                    {hospital.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {hospital.name}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {hospital.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer" title="Favorite">
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer" title="Open in Map">
                    <Map className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {hospital.status === 'Active' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/30">
                    <CheckCircle2 className="w-3 h-3" /> Network Hospital
                  </span>
                ) : hospital.status === 'Under Review' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-200 dark:border-amber-800/30">
                    <AlertCircle className="w-3 h-3" /> Under Review
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider border border-rose-200 dark:border-rose-800/30">
                    <X className="w-3 h-3" /> Inactive
                  </span>
                )}
                
                {hospital.cashlessAvailable && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/30">
                    <ShieldCheck className="w-3 h-3" /> Cashless Available
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Hospital Type</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{hospital.type}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Specialties</p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {hospital.specialties.join(' • ')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">TPA Partners</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{hospital.tpa[0]} {hospital.tpa.length > 1 ? `+${hospital.tpa.length - 1}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Contact</p>
                    <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> {hospital.phone}
                    </p>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Footer Action */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20">
              <button 
                onClick={() => setSelectedHospital(hospital)}
                className="w-full py-2.5 text-center text-sm font-black text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                View Hospital Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
          ))
        )}
      </div>

      {/* 5. RESULT SUMMARY FOOTER */}
      <div className="flex justify-center mt-6">
        <span className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
          Showing {filteredHospitals.length} of {HOSPITALS.length} network hospitals
        </span>
      </div>

      {/* 6. DETAILS DRAWER */}
      <AnimatePresence>
        {selectedHospital && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHospital(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            />
            
            {/* Modal */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0b1120] max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" /> Hospital Details
                </h2>
                <button 
                  onClick={() => setSelectedHospital(null)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800/30 flex items-center justify-center text-4xl font-black text-blue-600 dark:text-cyan-400">
                    {selectedHospital.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedHospital.name}</h3>
                    <div className="flex items-center justify-center gap-1.5 mt-1 text-sm font-bold text-amber-500">
                      <Star className="w-4 h-4 fill-current" /> {selectedHospital.rating} Rating
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-2 pt-2">
                    {selectedHospital.status === 'Active' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Network Active
                      </span>
                    )}
                    {selectedHospital.cashlessAvailable && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-blue-200 dark:border-blue-800/30">
                        <ShieldCheck className="w-3.5 h-3.5" /> Cashless Approved
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Address</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedHospital.fullAddress}</p>
                  </div>
                  
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /> Contact Information</p>
                    <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{selectedHospital.phone}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Facility Details</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Type</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedHospital.type}</p>
                    </div>
                    
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Available Specialties</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedHospital.specialties.map(spec => (
                          <span key={spec} className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Cashless Procedures Supported</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedHospital.cashlessServices.map(srv => (
                          <span key={srv} className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 text-xs font-bold flex items-center gap-1">
                            <Activity className="w-3 h-3" /> {srv}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Supported TPA Partners</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedHospital.tpa.map(tpa => (
                          <span key={tpa} className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-blue-500" /> {tpa}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-500 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-4 h-4" /> 24/7 Emergency Available
                  </p>
                  <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    Emergency care is covered under cashless provisions subject to policy terms. Last verified: {selectedHospital.lastVerified}
                  </p>
                </div>

              </div>
              
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3 shrink-0">
                <button 
                  onClick={() => window.alert(`Calling ${selectedHospital.phone}...`)}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" /> Contact Hospital
                </button>
                <button 
                  onClick={() => window.alert(`Opening Network Agreement for ${selectedHospital.name}...`)}
                  className="flex-1 py-3 px-4 bg-white dark:bg-[#0b1120] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm transition-all cursor-pointer"
                >
                  View Network Agreement
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
