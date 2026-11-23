import React, { useState, useEffect, useCallback } from 'react';
import { profileApi, clinicalApi } from '../../../services/dhrApis';
import { 
  Award, 
  Building2, 
  CheckCircle2, 
  Edit3, 
  Save, 
  FileBadge
} from 'lucide-react';

interface NurseProfileViewProps {
  user?: { name?: string; email?: string; [key: string]: any };
}

export const NurseProfileView: React.FC<NurseProfileViewProps> = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [completedVisitsCount, setCompletedVisitsCount] = useState<number>(0);
  const [profile, setProfile] = useState({
    id: '',
    name: user?.name || '',
    designation: '',
    licenseNo: '',
    hospital: '',
    department: '',
    email: user?.email || '',
    phone: '',
    experience: '',
    specialties: [] as string[],
    shiftStatus: 'On Duty • Available for Dispatch',
    bio: '',
    abhaId: '',
  });

  const [savedToast, setSavedToast] = useState(false);

  const hydrateNurseProfile = useCallback(async () => {
    try {
      const [nurseRes, userRes, careRes] = await Promise.all([
        profileApi.getNurseProfile().catch(() => null),
        profileApi.getProfile().catch(() => null),
        clinicalApi.getNurseCareRequests().catch(() => null),
      ]);

      const d: any = userRes?.data;
      const n: any = nurseRes?.data || d?.profile || d?.nurse;

      if (careRes && Array.isArray(careRes.data)) {
        const completed = careRes.data.filter(
          (r: any) => String(r.status || '').toUpperCase() === 'COMPLETED'
        ).length;
        setCompletedVisitsCount(completed);
      }

      if (!n && !d) return;

      let parsedSpecs: string[] = [];
      if (n?.specialtiesJson) {
        try {
          const p = JSON.parse(n.specialtiesJson);
          if (Array.isArray(p)) parsedSpecs = p;
        } catch {}
      }

      setProfile((prev) => ({
        ...prev,
        id: n?.id || d?.id || prev.id,
        name: n?.fullName || d?.fullName || user?.name || '',
        designation: n?.designation || '',
        licenseNo: n?.licenseNumber || '',
        hospital: n?.hospital || '',
        department: n?.department || '',
        email: d?.email || user?.email || '',
        phone: n?.phone || d?.phoneNumber || '',
        experience: n?.experienceYears != null ? `${n.experienceYears} Years` : '',
        specialties: parsedSpecs,
        bio: n?.bio || '',
        abhaId: d?.abhaId || '',
      }));
    } catch (err) {
      console.error('Failed to load nurse profile from MySQL:', err);
    }
  }, [user?.email, user?.name]);

  useEffect(() => {
    hydrateNurseProfile();
  }, [hydrateNurseProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expNum = parseInt(String(profile.experience).replace(/[^\d]/g, ''), 10);
      await profileApi.updateNurseProfile({
        fullName: profile.name,
        designation: profile.designation || undefined,
        licenseNumber: profile.licenseNo || undefined,
        hospital: profile.hospital || undefined,
        department: profile.department || undefined,
        phone: profile.phone || undefined,
        experienceYears: Number.isFinite(expNum) ? expNum : undefined,
        bio: profile.bio || undefined,
        specialtiesJson: JSON.stringify(profile.specialties),
      });
      await hydrateNurseProfile();
      setIsEditing(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err) {
      console.error('Failed to update nurse profile:', err);
    }
  };

  const displayName = profile.name || 'Registered Nurse';
  const initials = displayName
    .replace(/^Nurse\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'RN';

  return (
    <div className="space-y-6 pb-16 font-sans select-none">
      
      {/* SAVED TOAST */}
      {savedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="pointer-events-auto select-auto px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Professional Profile & Credentials Updated Successfully!</span>
          </div>
        </div>
      )}

      {/* HEADER HERO */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white border border-slate-700/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center font-black text-3xl shadow-lg border-2 border-white/20 shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {profile.shiftStatus}
              </span>
              {profile.id && (
                <span className="text-xs font-mono font-bold text-slate-400">
                  ID: RN-{profile.id.slice(-5).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {displayName}
            </h1>
            <p className="text-xs text-rose-200/80 font-semibold mt-0.5">
              {profile.designation || 'Registered Nurse (RN)'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs border border-white/20 shadow-sm cursor-pointer transition-all flex items-center gap-2 self-start md:self-center"
        >
          {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          <span>{isEditing ? 'Cancel Edit' : 'Edit Credentials'}</span>
        </button>
      </div>

      {/* 2-COLUMN PROFILE CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: BADGES & CERTIFICATES */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileBadge className="w-4 h-4 text-rose-500" /> License & Credentials
            </h3>

            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Nursing License</span>
                <strong className="font-mono text-slate-900 dark:text-white">{profile.licenseNo || 'Not Recorded'}</strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Experience</span>
                <strong className="text-slate-900 dark:text-white">{profile.experience || 'Not Recorded'}</strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">ABDM Registry</span>
                <strong className="text-emerald-600 font-mono font-black">{profile.abhaId || 'Not Linked'}</strong>
              </div>
            </div>

            <div className="space-y-2 pt-2 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Hospital Affiliation</span>
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                {profile.hospital || 'Not Recorded'}
              </p>
              <p className="text-slate-500 text-[11px]">{profile.department || 'General Nursing Unit'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Verified Care Activity
            </h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {completedVisitsCount} {completedVisitsCount === 1 ? 'Visit' : 'Visits'}
            </p>
            <p className="text-xs text-slate-500">
              Completed in-home clinical care visits recorded in the DHR database.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED INFO & SPECIALIZATIONS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">Designation</label>
                    <input
                      type="text"
                      value={profile.designation}
                      onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                      placeholder="e.g. Senior Registered Nurse (RN)"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">License Number</label>
                    <input
                      type="text"
                      value={profile.licenseNo}
                      onChange={(e) => setProfile({ ...profile, licenseNo: e.target.value })}
                      placeholder="e.g. RN-2026-XXXXX"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">Hospital</label>
                    <input
                      type="text"
                      value={profile.hospital}
                      onChange={(e) => setProfile({ ...profile, hospital: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 uppercase font-bold mb-1">Department</label>
                    <input
                      type="text"
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 uppercase font-bold mb-1">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Clinical Bio & Overview</h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    {profile.bio || 'No clinical bio recorded yet. Click "Edit Credentials" to add your professional overview.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Clinical Specializations & Procedures</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.specialties.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No specializations listed yet.</span>
                    ) : (
                      profile.specialties.map((spec, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800"
                        >
                          ✓ {spec}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Official Email</span>
                    <strong className="text-slate-900 dark:text-white mt-0.5 block truncate">{profile.email || 'Not Recorded'}</strong>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Emergency Clinical Mobile</span>
                    <strong className="text-slate-900 dark:text-white mt-0.5 block">{profile.phone || 'Not Recorded'}</strong>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
