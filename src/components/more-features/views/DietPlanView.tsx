import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { patientExtendedApi, profileApi } from '../../../services/dhrApis';
import { 
  Apple, ChevronRight, Search, History, Plus, AlertCircle, 
  Droplets, Target, Sparkles, RefreshCw, Edit2, Trash2, 
  CheckCircle2, X, FileText, Save, Download, Send, CheckSquare, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DietPlanViewProps {
  patientName?: string;
  user?: any;
}

export function DietPlanView({ patientName, user }: DietPlanViewProps = {}) {
  // --- STATE ---
  type TabType = 'plan' | 'analysis' | 'history';
  const [activeTab, setActiveTab] = useState<TabType>('plan');
  const [activeDay, setActiveDay] = useState('Monday');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [meals, setMeals] = useState<any[]>([]);

  // Live Patient Profile & Assessment State (Hydrated from MySQL)
  const [patientInfo, setPatientInfo] = useState({
    name: patientName || user?.name || 'Patient',
    id: user?.abhaId || 'Not Recorded',
    age: user?.age ? String(user.age) : 'Not Recorded',
    activity: 'Not Recorded',
    goal: 'Balanced Nutrition',
    allergies: 'None Recorded',
    lastUpdated: 'Not Saved Yet',
    avatar: (patientName || user?.name || 'P').slice(0, 1).toUpperCase(),
  });

  const [assessment, setAssessment] = useState({
    eatingPattern: 'Regular meals',
    activityLevel: 'Moderate',
    mealFrequency: '4 meals',
    hydrationHabit: 'Moderate',
    foodPreference: 'South Indian',
    dietaryRestriction: 'Vegetarian',
    goal: 'Balanced Nutrition',
    planDuration: '4 Weeks',
    targetCalories: 2000,
    targetProtein: 75,
    notes: '',
    nextReview: '',
    reviewFrequency: 'Weekly',
    updatedAt: null as string | null,
  });

  const [allergiesArray, setAllergiesArray] = useState<string[]>([]);

  // Calculate current week dates dynamically
  const weekDates = React.useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay() || 7; // Monday = 1, Sunday = 7
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + 1);
    
    const dates = [];
    const daysArr = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push({
        day: daysArr[i],
        date: d.getDate(),
        month: monthNames[d.getMonth()]
      });
    }
    return dates;
  }, []);

  useEffect(() => {
    // Set active day to today automatically
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    setActiveDay(todayName);
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const [response, assessRes, profRes] = await Promise.all([
        api.get('/diet/me/meals').catch(() => ({ data: [] })),
        patientExtendedApi.getDietAssessment().catch(() => null),
        profileApi.getPatientProfile().catch(() => null),
      ]);
      setMeals(Array.isArray(response?.data) ? response.data : []);

      const pat: any = profRes?.data;
      const assess: any = assessRes?.data;

      const patAllergies: string[] = Array.isArray(pat?.allergies)
        ? pat.allergies.map((a: any) => a.allergen || a.name).filter(Boolean)
        : [];
      setAllergiesArray(patAllergies);

      const calcAge = pat?.dateOfBirth
        ? String(Math.max(1, new Date().getFullYear() - new Date(pat.dateOfBirth).getFullYear()))
        : user?.age ? String(user.age) : 'Not Recorded';

      const resolvedName = pat?.fullName || patientName || user?.name || 'Patient';
      const resolvedId = pat?.abhaId || pat?.id?.slice(-8)?.toUpperCase() || user?.abhaId || 'Not Recorded';

      setPatientInfo({
        name: resolvedName,
        id: resolvedId,
        age: calcAge,
        activity: assess?.activityLevel || 'Not Recorded',
        goal: assess?.goal || 'Balanced Nutrition',
        allergies: patAllergies.length > 0 ? patAllergies.join(', ') : 'None Recorded',
        lastUpdated: assess?.updatedAt
          ? new Date(assess.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Not Saved Yet',
        avatar: resolvedName.slice(0, 1).toUpperCase(),
      });

      if (assess) {
        let extraConditions: any = {};
        if (assess.conditionsJson) {
          try { extraConditions = JSON.parse(assess.conditionsJson); } catch {}
        }
        setAssessment((prev) => ({
          ...prev,
          goal: assess.goal || prev.goal,
          foodPreference: assess.dietPreference || prev.foodPreference,
          activityLevel: assess.activityLevel || prev.activityLevel,
          targetCalories: assess.targetCalories || prev.targetCalories,
          notes: assess.notes || prev.notes,
          eatingPattern: extraConditions?.eatingPattern || prev.eatingPattern,
          mealFrequency: extraConditions?.mealFrequency || prev.mealFrequency,
          hydrationHabit: extraConditions?.hydrationHabit || prev.hydrationHabit,
          dietaryRestriction: extraConditions?.dietaryRestriction || prev.dietaryRestriction,
          planDuration: extraConditions?.planDuration || prev.planDuration,
          targetProtein: extraConditions?.targetProtein || prev.targetProtein,
          nextReview: extraConditions?.nextReview || prev.nextReview,
          reviewFrequency: extraConditions?.reviewFrequency || prev.reviewFrequency,
          updatedAt: assess.updatedAt || null,
        }));
      }

      if (assess?.checklistJson) {
        try {
          const parsed = JSON.parse(assess.checklistJson);
          if (parsed && typeof parsed === 'object') setInstructions((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to fetch diet data from MySQL:', e);
      setMeals([]);
    }
  };
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Modals & Drawers
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSwapDrawer, setShowSwapDrawer] = useState(false);
  const [showMealDrawer, setShowMealDrawer] = useState(false);
  
  // Selection States
  const [selectedMealForSwap, setSelectedMealForSwap] = useState<any>(null);
  const [editingMeal, setEditingMeal] = useState<any>(null);
  const [mealDays, setMealDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [mealForm, setMealForm] = useState<any>({ type: 'Breakfast', time: '08:00 AM', name: '', portion: '', cal: '', pro: '', carbs: '50', fat: '15' });

  // Form States (Simplified for UI Demo)
  const [instructions, setInstructions] = useState({ timings: true, hydration: true, portions: false, track: true, review: false, share: true });

  const saveAssessmentToDb = async (overrides: Partial<typeof assessment> = {}, statusLabel?: string) => {
    const merged = { ...assessment, ...overrides };
    setAssessment(merged);
    try {
      const res = await patientExtendedApi.saveDietAssessment({
        goal: merged.goal,
        dietPreference: merged.foodPreference,
        activityLevel: merged.activityLevel,
        targetCalories: Number(merged.targetCalories) || 2000,
        allergies: allergiesArray,
        conditions: {
          eatingPattern: merged.eatingPattern,
          mealFrequency: merged.mealFrequency,
          hydrationHabit: merged.hydrationHabit,
          dietaryRestriction: merged.dietaryRestriction,
          planDuration: merged.planDuration,
          targetProtein: Number(merged.targetProtein) || 75,
          nextReview: merged.nextReview,
          reviewFrequency: merged.reviewFrequency,
          planStatus: statusLabel || 'Active',
        },
        checklist: instructions,
        notes: merged.notes,
      });
      if (res?.data?.updatedAt) {
        const dtStr = new Date(res.data.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        setAssessment((prev) => ({ ...prev, updatedAt: res.data.updatedAt }));
        setPatientInfo((prev) => ({
          ...prev,
          activity: merged.activityLevel,
          goal: merged.goal,
          lastUpdated: dtStr,
        }));
      }
      return true;
    } catch (e) {
      console.error('Failed to save diet assessment:', e);
      return false;
    }
  };

  const handleSwapMeal = async (alt: { name: string; portion: string; cal: number; pro: number }) => {
    if (!selectedMealForSwap) return;
    try {
      const payload = {
        ...selectedMealForSwap,
        name: alt.name,
        portion: alt.portion,
        cal: alt.cal,
        pro: alt.pro,
      };
      const response = await api.put(`/diet/me/meals/${selectedMealForSwap.id}`, payload);
      setMeals((prev) => prev.map((m) => (m.id === selectedMealForSwap.id ? (response?.data || payload) : m)));
      setShowSwapDrawer(false);
      setSelectedMealForSwap(null);
      showToast(`✓ Replaced meal with ${alt.name} in database`);
    } catch (e) {
      console.error('Failed to swap meal:', e);
      showToast('Failed to swap meal');
    }
  };

  const toggleInstruction = (key: keyof typeof instructions) => {
    setInstructions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      patientExtendedApi.saveDietAssessment({
        goal: assessment.goal,
        dietPreference: assessment.foodPreference,
        activityLevel: assessment.activityLevel,
        targetCalories: Number(assessment.targetCalories) || 2000,
        allergies: allergiesArray,
        checklist: next,
        notes: assessment.notes,
      }).catch(() => {});
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenMealDrawer = (meal?: any) => {
    setEditingMeal(meal || null);
    if (meal) {
      setMealForm({
        type: meal.type,
        time: meal.time,
        name: meal.name,
        portion: meal.portion,
        cal: meal.cal,
        pro: meal.pro,
        carbs: meal.carbs || 50,
        fat: meal.fat || 15
      });
      setMealDays(meal.days.map((d: string) => d.substring(0, 3)));
    } else {
      setMealForm({
        type: 'Breakfast',
        time: '08:00 AM',
        name: '',
        portion: '',
        cal: '',
        pro: '',
        carbs: '50',
        fat: '15'
      });
      setMealDays([activeDay.substring(0, 3)]);
    }
    setShowMealDrawer(true);
  };

  const handleSaveMeal = async () => {
    const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].filter(d => mealDays.includes(d.substring(0, 3)));
    
    try {
      if (editingMeal) {
        const response = await api.put(`/diet/me/meals/${editingMeal.id}`, { ...mealForm, days: fullDays });
        setMeals(prev => prev.map(m => m.id === editingMeal.id ? response.data : m));
        showToast("Meal updated");
      } else {
        const response = await api.post('/diet/me/meals', { ...mealForm, days: fullDays });
        setMeals(prev => [...prev, response.data]);
        showToast("Meal added");
      }
    } catch (e) {
       console.error("Failed to save meal", e);
       showToast("Failed to save meal (see console)");
    }
    setShowMealDrawer(false);
  };

  const handleDeleteMeal = async (id: string | number) => {
    try {
      await api.delete(`/diet/me/meals/${id}`);
      setMeals(prev => prev.filter(m => m.id !== id));
      showToast("Meal deleted");
    } catch (e) {
      console.error("Failed to delete meal", e);
      showToast("Failed to delete meal (see console)");
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- RENDERERS ---

  const renderAssessmentModal = () => (
    <AnimatePresence>
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssessmentModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col rounded-3xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-500" /> New Plan Assessment
              </h2>
              <button onClick={() => setShowAssessmentModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Nutrition Assessment */}
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest text-slate-500">Patient Habits & Preferences</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Eating Pattern</label>
            <select
              value={assessment.eatingPattern}
              onChange={(e) => setAssessment((prev) => ({ ...prev, eatingPattern: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>Regular meals</option>
              <option>Irregular meals</option>
              <option>Frequently skips meals</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Activity Level</label>
            <select
              value={assessment.activityLevel}
              onChange={(e) => setAssessment((prev) => ({ ...prev, activityLevel: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>Sedentary</option>
              <option>Light</option>
              <option>Moderate</option>
              <option>Active</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Meal Frequency</label>
            <select
              value={assessment.mealFrequency}
              onChange={(e) => setAssessment((prev) => ({ ...prev, mealFrequency: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>2 meals</option>
              <option>3 meals</option>
              <option>4 meals</option>
              <option>5+ meals</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Hydration Habit</label>
            <select
              value={assessment.hydrationHabit}
              onChange={(e) => setAssessment((prev) => ({ ...prev, hydrationHabit: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>Low</option>
              <option>Moderate</option>
              <option>Good</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Food Preferences</label>
            <select
              value={assessment.foodPreference}
              onChange={(e) => setAssessment((prev) => ({ ...prev, foodPreference: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>South Indian</option>
              <option>North Indian</option>
              <option>Indian</option>
              <option>Mixed</option>
              <option>Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Dietary Restrictions</label>
            <select
              value={assessment.dietaryRestriction}
              onChange={(e) => setAssessment((prev) => ({ ...prev, dietaryRestriction: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option>Vegetarian</option>
              <option>Non-Vegetarian</option>
              <option>Vegan</option>
              <option>Eggetarian</option>
              <option>Dairy-Free</option>
              <option>Gluten-Free</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end"></div>
      </div>

      {/* Goals & Targets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Nutrition Goals */}
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 col-span-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-500" /> Nutrition Goals
          </h3>
          <div className="space-y-4">
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Primary Goal</label>
              <select
                value={assessment.goal}
                onChange={(e) => setAssessment((prev) => ({ ...prev, goal: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option>Balanced Nutrition</option>
                <option>Weight Management</option>
                <option>Improve Energy</option>
                <option>Heart-Healthy Nutrition</option>
                <option>Diabetes-Friendly Nutrition</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Plan Duration</label>
              <select
                value={assessment.planDuration}
                onChange={(e) => setAssessment((prev) => ({ ...prev, planDuration: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option>2 Weeks</option>
                <option>4 Weeks</option>
                <option>8 Weeks</option>
                <option>12 Weeks</option>
              </select>
            </div>
          </div>
        </div>

        {/* Nutrient Targets */}
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 col-span-1 lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-500" /> Nutrient Targets
            </h3>
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Calories', val: String(assessment.targetCalories), unit: 'kcal/day', color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' },
                { label: 'Protein', val: String(assessment.targetProtein), unit: 'g/day', color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' },
                { label: 'Carbohydrates', val: String(Math.round((assessment.targetCalories * 0.5) / 4)), unit: 'g/day', color: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' },
                { label: 'Healthy Fats', val: String(Math.round((assessment.targetCalories * 0.3) / 9)), unit: 'g/day', color: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' },
                { label: 'Fibre', val: '30', unit: 'g/day', color: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30' },
                { label: 'Water', val: '2.5', unit: 'L/day', color: 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-900/30' },
              ].map(t => (
                <div key={t.label} className={`p-4 rounded-2xl border ${t.color}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{t.label}</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{t.val} <span className="text-sm font-semibold text-slate-500">{t.unit}</span></div>
                </div>
              ))}
           </div>
        </div>

      </div>
      
      <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
         <button onClick={() => setShowAssessmentModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors">Cancel</button>
         <button
           onClick={async () => {
             const ok = await saveAssessmentToDb({}, 'Active');
             setShowAssessmentModal(false);
             setActiveTab('plan');
             showToast(ok ? '✓ Assessment saved to database!' : 'Failed to save assessment');
           }}
           className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
         >
           Save Assessment
         </button>
      </div>
      
    </div>
    </motion.div>
    </div>
    )}
    </AnimatePresence>
  );

  const renderMealPlanTab = () => (
    <div className="animate-in fade-in duration-500">
      
      {/* AI Generate Prompt Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl p-6 sm:p-5 mb-8 relative overflow-hidden shadow-lg border border-slate-800 flex items-center justify-between">
        <div className="absolute inset-0 bg-cyan-500/10 blur-xl rounded-full translate-y-1/2"></div>
        <div className="relative z-10 w-full flex items-center justify-center gap-3 text-center">
          <h2 className="text-xl sm:text-2xl font-medium text-slate-300 uppercase tracking-widest">
            Healthcare Meal Plan <span className="text-slate-500 mx-2">|</span> <span className="text-white font-bold tracking-normal">AI Generation ✨</span>
          </h2>
        </div>
        <button onClick={() => setShowAIModal(true)} className="relative z-10 p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors">
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Planner */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Day Tabs - Floating Pills */}
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-4 px-1">
            {weekDates.map(({ day, date }) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex flex-col items-center justify-center min-w-[70px] h-20 rounded-2xl transition-all shadow-sm border ${
                  activeDay === day 
                    ? 'bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-600 shadow-md transform -translate-y-1' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-0.5'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${activeDay === day ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                  {day.substring(0, 3)}
                </span>
                <span className={`text-xl font-black ${activeDay === day ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                  {date}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-4 mt-2 px-1">
             <h3 className="text-xl font-black text-slate-900 dark:text-white">
               {activeDay}, {weekDates.find(d => d.day === activeDay)?.month} {weekDates.find(d => d.day === activeDay)?.date}
             </h3>
          </div>

          {/* Meals List */}
          <div className="space-y-6">
            {meals.filter(m => m.days.includes(activeDay)).map((meal) => (
              <div key={meal.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow group relative">
                
                <div className="flex justify-between items-start mb-4">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                     {meal.type}
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="flex items-center gap-0.5">
                       <button onClick={() => { setSelectedMealForSwap(meal); setShowSwapDrawer(true); }} className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors" title="Swap Food">
                         <RefreshCw className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleOpenMealDrawer(meal)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit Meal">
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleDeleteMeal(meal.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Delete Meal">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                     <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                       {meal.cal} kcal
                     </div>
                   </div>
                </div>

                <div className="flex items-start gap-5">
                   <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 shrink-0 shadow-inner text-3xl">
                     {meal.type === 'Breakfast' ? '🥑' : meal.type === 'Lunch' ? '🥗' : meal.type.includes('Snack') ? '🍎' : '🍲'}
                   </div>
                   <div className="flex-1">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">{meal.name}</h4>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">{meal.portion}</p>
                      
                      <div className="flex flex-wrap items-center gap-3">
                         <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                           {meal.time}
                         </div>
                         <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
                           {meal.pro}g Protein
                         </div>
                         <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
                           {meal.carbs || Math.round(meal.cal * 0.5 / 4)}g Carbs
                         </div>
                         <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
                           {meal.fat || Math.round(meal.cal * 0.3 / 9)}g Fat
                         </div>
                      </div>
                   </div>
                </div>

              </div>
            ))}

            <button onClick={() => handleOpenMealDrawer()} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-cyan-500 hover:text-cyan-500 dark:hover:border-cyan-500 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-all flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Add Meal
            </button>
          </div>
        </div>

        {/* Sidebar: Recommendations & Limitations */}
        <div className="space-y-6">
           {/* RECOMMENDED FOODS */}
           <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6">
              Recommended Foods
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {[
                'Leafy Greens (Veg)', 'Berries (Fruit)', 'Nuts (Snack)', 
                'Salmon (Omega-3)', 'Oats (Grains)', 'Greek Yogurt (Probiotic)'
              ].map(f => (
                <span key={f} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-default">
                  {f}
                </span>
              ))}
            </div>
            
            <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-8"></div>

            {/* FOODS TO LIMIT */}
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6">
              Foods to Limit
            </h3>
            <ul className="space-y-4">
              {[
                'Sugary Drinks',
                'Red Meat',
                'Processed Foods',
                'High Sodium',
                'Refined Grains'
              ].map(item => (
                <li key={item} className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                  {item}
                  <X className="w-4 h-4 text-slate-400" />
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );

  const renderAnalysisTab = () => {
    const dayMeals = meals.filter((m) => Array.isArray(m.days) && m.days.includes(activeDay));
    const totalCal = dayMeals.reduce((sum, m) => sum + (Number(m.cal) || 0), 0);
    const totalPro = dayMeals.reduce((sum, m) => sum + (Number(m.pro) || 0), 0);
    const totalCarbs = dayMeals.reduce((sum, m) => sum + (Number(m.carbs) || Math.round((Number(m.cal) || 0) * 0.5 / 4)), 0);
    const totalFat = dayMeals.reduce((sum, m) => sum + (Number(m.fat) || Math.round((Number(m.cal) || 0) * 0.3 / 9)), 0);
    const targetCal = Number(assessment.targetCalories) || 2000;
    const targetPro = Number(assessment.targetProtein) || 75;
    const targetCarbs = Math.round((targetCal * 0.5) / 4);
    const targetFat = Math.round((targetCal * 0.3) / 9);

    const calScore = targetCal > 0 ? Math.min(100, Math.round((totalCal / targetCal) * 100)) : 0;
    const proScore = targetPro > 0 ? Math.min(100, Math.round((totalPro / targetPro) * 100)) : 0;
    const qualityScore = meals.length === 0 ? 0 : Math.round((calScore + proScore) / 2);
    const weeklyCounts = days.map((d) => meals.filter((m) => Array.isArray(m.days) && m.days.includes(d)).length);
    const maxDayCount = Math.max(1, ...weeklyCounts);
    const activeInstructionCount = Object.values(instructions).filter(Boolean).length;
    const instructionPct = Math.round((activeInstructionCount / Object.keys(instructions).length) * 100);

    return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quality Score */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" /> Nutrition Plan Quality
            </h2>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">{qualityScore}</span>
              <span className="text-xl font-bold text-slate-400 mb-1">/ 100</span>
            </div>
            <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider rounded-lg mb-8 border border-emerald-200 dark:border-emerald-800/50">
              Status: {qualityScore >= 75 ? 'Good' : qualityScore > 0 ? 'Needs Tuning' : 'No Meals Yet'}
            </div>
            
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Breakdown</p>
              {[
                { label: 'Meal Balance', ok: dayMeals.length >= 3 },
                { label: 'Protein Coverage', ok: proScore >= 70 },
                { label: 'Hydration Checklist', ok: instructions.hydration },
                { label: 'Food Variety', ok: meals.length >= 3 },
                { label: 'Calorie Target', ok: calScore >= 70 },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {b.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> : <AlertCircle className="w-4 h-4 text-amber-500 shrink-0"/>}
                  {b.label}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-6">* Computed from your saved meals in the database for {activeDay}.</p>
        </div>

        {/* Daily Nutrient Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6 flex items-center gap-2">
             <Apple className="w-4 h-4 text-cyan-500" /> Daily Nutrient Breakdown ({activeDay})
          </h2>
          <div className="space-y-6">
            {[
              { label: 'Calories', current: totalCal, max: targetCal, unit: 'kcal', color: 'bg-amber-400' },
              { label: 'Protein', current: totalPro, max: targetPro, unit: 'g', color: 'bg-blue-400' },
              { label: 'Carbohydrates', current: totalCarbs, max: targetCarbs, unit: 'g', color: 'bg-emerald-400' },
              { label: 'Fat', current: totalFat, max: targetFat, unit: 'g', color: 'bg-rose-400' },
            ].map(macro => {
              const percent = macro.max > 0 ? Math.min(100, Math.round((macro.current / macro.max) * 100)) : 0;
              return (
                <div key={macro.label}>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">{macro.label}</span>
                    <span className="text-slate-900 dark:text-white">{macro.current} <span className="text-slate-400 font-medium">/ {macro.max} {macro.unit}</span></span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full ${macro.color} rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Weekly Progress & Adherence */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-500" /> Weekly Meal Coverage
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Planned Meals</p>
               <div className="text-3xl font-black text-slate-900 dark:text-white">{meals.length}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Checklist Active</p>
               <div className="text-3xl font-black text-slate-900 dark:text-white">{instructionPct}%</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Today's Target</p>
               <div className="text-3xl font-black text-slate-900 dark:text-white">{calScore}%</div>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-2 opacity-80">
            {weeklyCounts.map((count, i) => {
              const h = meals.length === 0 ? 0 : Math.round((count / maxDayCount) * 100);
              return (
                <div key={i} className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-t-xl relative group overflow-hidden">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }} className="absolute bottom-0 w-full bg-cyan-500/80 group-hover:bg-cyan-400 transition-colors"></motion.div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs font-bold text-slate-400">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>

        {/* Clinical Notes & Instructions */}
        <div className="space-y-8 col-span-1">
          {/* Notes */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" /> Clinical Notes
            </h2>
            <textarea 
              value={assessment.notes}
              onChange={(e) => setAssessment((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white rounded-2xl p-4 outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none h-32 mb-4" 
              placeholder="Enter clinical observations, adjustments, and dietetic notes here..."
            />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Next Review</label>
                <input
                  type="date"
                  value={assessment.nextReview}
                  onChange={(e) => setAssessment((prev) => ({ ...prev, nextReview: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Frequency</label>
                <select
                  value={assessment.reviewFrequency}
                  onChange={(e) => setAssessment((prev) => ({ ...prev, reviewFrequency: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option>Weekly</option>
                  <option>Bi-Weekly</option>
                  <option>Monthly</option>
                </select>
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = await saveAssessmentToDb();
                showToast(ok ? '✓ Clinical notes saved to database!' : 'Failed to save clinical notes');
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
            >
              Save Notes
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-cyan-500" /> Patient Instructions
            </h2>
            <div className="space-y-3 mb-6">
              {[
                { key: 'timings', label: 'Follow scheduled meal timings' },
                { key: 'hydration', label: 'Maintain daily hydration' },
                { key: 'portions', label: 'Follow recommended portions' },
                { key: 'track', label: 'Track meals regularly' },
                { key: 'review', label: 'Review progress during follow-up' }
              ].map(item => (
                <div 
                  key={item.key} onClick={() => toggleInstruction(item.key as keyof typeof instructions)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors"
                >
                  {instructions[item.key as keyof typeof instructions] 
                    ? <CheckSquare className="w-5 h-5 text-cyan-500 shrink-0" /> 
                    : <Square className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                  }
                  <span className={`text-sm font-bold ${instructions[item.key as keyof typeof instructions] ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800/30 rounded-xl cursor-pointer" onClick={() => toggleInstruction('share')}>
              {instructions.share ? <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> : <Square className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
              <span className="text-xs font-black text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">Share instructions with patient</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    );
  };

  const renderHistoryTab = () => (
    <div id="plan-history-section" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 animate-in fade-in duration-500">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <History className="w-4 h-4 text-cyan-500" /> Plan History & Versions
      </h3>

      {!assessment.updatedAt && meals.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
          No saved nutrition plan history yet. Create an assessment or add meals to start tracking.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="pb-4 text-xs font-black uppercase tracking-wider text-slate-500">Plan Name</th>
                <th className="pb-4 text-xs font-black uppercase tracking-wider text-slate-500">Duration</th>
                <th className="pb-4 text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="pb-4 text-xs font-black uppercase tracking-wider text-slate-500">Updated</th>
                <th className="pb-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-bold text-slate-700 dark:text-slate-300">
              <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="py-4">{assessment.goal} Plan <br/><span className="text-xs font-medium text-slate-400">{meals.length} planned meals · {assessment.targetCalories} kcal/day</span></td>
                <td className="py-4 text-slate-500">{assessment.planDuration}</td>
                <td className="py-4"><span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">Active</span></td>
                <td className="py-4">{patientInfo.lastUpdated}</td>
                <td className="py-4 text-right space-x-3">
                  <button onClick={() => setActiveTab('plan')} className="text-cyan-600 hover:underline">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1c] text-slate-900 dark:text-slate-200 pb-32">
      
      {/* TOAST */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center pointer-events-none select-none max-w-md w-full px-4">
        <AnimatePresence>
          {toastMessage && (
            <motion.div initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }} className="px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 pointer-events-auto border border-slate-800 dark:border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-500" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* 1. HEADER */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 tracking-wide uppercase">
              <span>Doctor Portal</span> <ChevronRight className="w-3 h-3" /> 
              <span>Patients</span> <ChevronRight className="w-3 h-3" /> 
              <span className="text-cyan-600 dark:text-cyan-400">Diet & Nutrient Plan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <Apple className="w-7 h-7 text-cyan-500" /> Diet & Nutrient Plan
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Create, customize, and monitor personalized nutrition plans for patients.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
              <input 
                type="text" 
                placeholder="Search meals..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 outline-none text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 w-48 sm:w-64 relative z-10" 
              />
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {showSearchResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 10 }} 
                    className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2">
                      {meals.filter((m) => String(m.name || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-500">No matching meals found</div>
                      ) : (
                        meals
                          .filter((m) => String(m.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                          .slice(0, 5)
                          .map((m) => (
                            <div
                              key={m.id}
                              className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
                              onClick={() => {
                                setSearchQuery('');
                                setShowSearchResults(false);
                                if (Array.isArray(m.days) && m.days[0]) setActiveDay(m.days[0]);
                                setActiveTab('plan');
                              }}
                            >
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{m.name}</p>
                              <p className="text-xs text-slate-500">{m.type} · {m.cal} kcal</p>
                            </div>
                          ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <button onClick={() => setActiveTab('history')} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
              <History className="w-4 h-4" /> View History
            </button>
            <button onClick={() => { 
                setShowAssessmentModal(true); 
              }} 
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" /> Create New Plan
            </button>
          </div>
        </div>

        {/* 2. PATIENT OVERVIEW (Compact) */}
        <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-md text-slate-300 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30 text-xl font-black text-cyan-400">
              {patientInfo.avatar}
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                {patientInfo.name}
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] uppercase tracking-widest rounded-md border border-slate-200 dark:border-slate-700">{patientInfo.id}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-3 md:gap-5 text-sm font-medium mt-1">
                <span className="flex items-center gap-1">Age: <strong className="text-white">{patientInfo.age}</strong></span>
                <span className="flex items-center gap-1">Activity: <strong className="text-white">{patientInfo.activity}</strong></span>
                <span className="flex items-center gap-1">Goal: <strong className="text-white">{patientInfo.goal}</strong></span>
                <span className="flex items-center gap-1">Allergies: <strong className="text-rose-400">{patientInfo.allergies}</strong></span>
              </div>
            </div>
          </div>

          <div className="relative z-10 shrink-0">
            <button className="text-sm font-bold text-cyan-400 hover:text-cyan-300 hover:underline">View Patient Profile</button>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1 text-right">Last Updated: {patientInfo.lastUpdated}</div>
          </div>
        </div>

        {/* 3. NUTRITION ALERTS */}
        {activeTab !== 'history' && (
          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-3 text-sm font-bold text-amber-800 dark:text-amber-500 shadow-sm">
              <AlertCircle className="w-4 h-4" /> ⚠ Protein target needs attention
            </div>
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl flex items-center gap-3 text-sm font-bold text-blue-800 dark:text-blue-400 shadow-sm">
              <Droplets className="w-4 h-4" /> 💧 Hydration goal is below target
            </div>
          </div>
        )}

        {/* MAIN NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
          {[
            { id: 'plan', label: 'Meal Plan' },
            { id: 'analysis', label: 'Analysis & Progress' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-6 py-4 text-sm font-black tracking-wide uppercase whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT RENDERER */}
        <div className="py-2">
          {activeTab === 'plan' && renderMealPlanTab()}
          {activeTab === 'analysis' && renderAnalysisTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>

      </div>

      {/* BOTTOM ACTION BAR (Sticky) */}
      <AnimatePresence>
        {activeTab !== 'history' && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 md:left-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 z-40"
          >
            <div className="max-w-7xl w-full mx-auto px-2 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm font-bold text-slate-500">
                Last saved: <span className="text-slate-900 dark:text-white">{patientInfo.lastUpdated}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                <button
                  onClick={async () => {
                    const ok = await saveAssessmentToDb({}, 'Draft');
                    showToast(ok ? '✓ Draft saved to database!' : 'Failed to save draft');
                  }}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Save Draft
                </button>
                <button onClick={() => setActiveTab('analysis')} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm hidden sm:block">
                  Preview Plan
                </button>
                <button
                  onClick={() => {
                    const content = JSON.stringify({ patientInfo, assessment, meals }, null, 2);
                    const blob = new Blob([content], { type: 'application/json' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `Diet_Plan_${patientInfo.name.replace(/\s+/g, '_')}.json`;
                    link.click();
                    showToast('✓ Exported diet plan');
                  }}
                  className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export Plan
                </button>
                <button onClick={() => setShowAssignModal(true)} className="px-8 py-2.5 bg-slate-900 dark:bg-cyan-600 text-white rounded-xl text-sm font-black hover:bg-slate-800 dark:hover:bg-cyan-500 transition-colors shadow-lg flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Assign Plan
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODALS & DRAWERS --- */}

      {/* AI GENERATION MODAL */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAIModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white">
                <h2 className="text-xl font-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-400" /> Generate Nutrition Plan</h2>
                <button onClick={() => setShowAIModal(false)} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nutrition Goal</label>
                    <select
                      value={assessment.goal}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, goal: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none"
                    >
                      <option>Balanced Nutrition</option>
                      <option>Weight Management</option>
                      <option>Heart-Healthy Nutrition</option>
                      <option>Diabetes-Friendly Nutrition</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Diet Type</label>
                    <select
                      value={assessment.foodPreference}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, foodPreference: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none"
                    >
                      <option>South Indian</option>
                      <option>North Indian</option>
                      <option>Indian</option>
                      <option>Mixed</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Cal</label>
                    <input
                      type="number"
                      value={assessment.targetCalories}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, targetCalories: Number(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Pro</label>
                    <input
                      type="number"
                      value={assessment.targetProtein}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, targetProtein: Number(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Frequency</label>
                    <select
                      value={assessment.mealFrequency}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, mealFrequency: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none"
                    >
                      <option>3 meals</option>
                      <option>4 meals</option>
                      <option>5+ meals</option>
                    </select>
                  </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Dietary Restrictions applied</label>
                   <div className="flex flex-wrap gap-2">
                     {allergiesArray.length > 0 ? (
                       allergiesArray.map((al) => (
                         <span key={al} className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                           {al}
                         </span>
                       ))
                     ) : (
                       <span className="text-xs text-slate-500 font-medium">No recorded allergies</span>
                     )}
                   </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                <button onClick={() => setShowAIModal(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    const ok = await saveAssessmentToDb({}, 'Generated');
                    setShowAIModal(false);
                    showToast(ok ? '✓ Nutrition targets saved to database!' : 'Failed to save nutrition targets');
                  }}
                  className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
                >
                  <Sparkles className="w-4 h-4"/> Save Targets
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MEAL SWAP MODAL */}
      <AnimatePresence>
        {showSwapDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSwapDrawer(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col rounded-3xl overflow-hidden max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-cyan-50 dark:bg-cyan-900/10">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><RefreshCw className="w-5 h-5 text-cyan-500" /> Swap Food</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Select an alternative for <strong className="text-slate-700 dark:text-slate-300">{selectedMealForSwap?.name}</strong></p>
                </div>
                <button onClick={() => setShowSwapDrawer(false)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {[
                  { name: "Dosa + Sambar", portion: "2 medium, 1 bowl", cal: 280, pro: 8 },
                  { name: "Vegetable Upma", portion: "1.5 cups", cal: 300, pro: 6 },
                  { name: "Pongal + Sambar", portion: "1 cup, 1 bowl", cal: 350, pro: 9 },
                  { name: "Oats + Fruit", portion: "1 bowl", cal: 250, pro: 10 }
                ].map((alt, i) => (
                  <div key={i} className="p-4 border border-slate-200 dark:border-slate-200 dark:border-slate-700 rounded-2xl hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-md transition-all cursor-pointer group flex justify-between items-center bg-white dark:bg-slate-800">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{alt.name}</h4>
                      <p className="text-xs font-medium text-slate-500 mb-2">{alt.portion}</p>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-amber-600 dark:text-amber-400">{alt.cal} kcal</span>
                        <span className="text-blue-600 dark:text-blue-400">{alt.pro}g pro</span>
                      </div>
                    </div>
                    <button onClick={() => handleSwapMeal(alt)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                      Replace
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MEAL EDIT MODAL */}
      <AnimatePresence>
        {showMealDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMealDrawer(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col rounded-3xl overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-cyan-500" /> {editingMeal ? 'Edit Meal' : 'Add New Meal'}
                </h2>
                <button onClick={() => setShowMealDrawer(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Meal Type</label>
                    <select value={mealForm.type} onChange={(e) => setMealForm({...mealForm, type: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 rounded-xl px-4 py-3 outline-none">
                      <option>Breakfast</option><option>Morning Snack</option><option>Lunch</option><option>Evening Snack</option><option>Dinner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Time</label>
                    <input type="time" value={mealForm.time.substring(0, 5)} onChange={(e) => setMealForm({...mealForm, time: e.target.value + ' AM'})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 rounded-xl px-4 py-2.5 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Days</label>
                  <div className="flex flex-wrap gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          setMealDays(prev => 
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                          mealDays.includes(day)
                            ? 'bg-cyan-500 text-white border-cyan-500'
                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-cyan-500'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Food Description</label>
                  <textarea value={mealForm.name} onChange={(e) => setMealForm({...mealForm, name: e.target.value})} rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white rounded-xl p-4 outline-none resize-none" placeholder="e.g. Oats Idli with Sambar" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Portion</label>
                  <input type="text" value={mealForm.portion} onChange={(e) => setMealForm({...mealForm, portion: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white rounded-xl px-4 py-3 outline-none" placeholder="e.g. 3 pieces, 1 cup" />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-200 dark:border-slate-700 rounded-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Macronutrients</h4>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                      <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 mb-1">Calories (kcal)</label>
                      <input type="number" value={mealForm.cal} onChange={(e) => setMealForm({...mealForm, cal: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl px-3 py-2 outline-none" />
                    </div>
                     <div>
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-500 mb-1">Protein (g)</label>
                      <input type="number" value={mealForm.pro} onChange={(e) => setMealForm({...mealForm, pro: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl px-3 py-2 outline-none" />
                    </div>
                     <div>
                      <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-500 mb-1">Carbs (g)</label>
                      <input type="number" value={mealForm.carbs} onChange={(e) => setMealForm({...mealForm, carbs: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl px-3 py-2 outline-none" />
                    </div>
                     <div>
                      <label className="block text-xs font-bold text-rose-600 dark:text-rose-500 mb-1">Fat (g)</label>
                      <input type="number" value={mealForm.fat} onChange={(e) => setMealForm({...mealForm, fat: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl px-3 py-2 outline-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                  <textarea rows={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white rounded-xl p-4 outline-none resize-none" placeholder="Special prep instructions..." />
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                <button onClick={() => setShowMealDrawer(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-200 dark:border-slate-700 font-bold rounded-xl transition-colors text-slate-700 dark:text-slate-300">Cancel</button>
                <button onClick={handleSaveMeal} className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-colors shadow-md"><Save className="w-4 h-4 inline-block mr-2" /> Save Meal</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ASSIGN CONFIRMATION MODAL */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-cyan-500/30">
                <Send className="w-10 h-10 text-white translate-x-1 -translate-y-0.5" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Assign Plan to Patient?</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 px-2">This will instantly notify <strong className="text-slate-700 dark:text-slate-300">{patientInfo.name}</strong> and update their mobile app with the new nutrition guidelines.</p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    const ok = await saveAssessmentToDb({}, 'Assigned');
                    setShowAssignModal(false);
                    showToast(ok ? '✓ Nutrition Plan Assigned & Saved to Database!' : 'Failed to assign plan');
                  }}
                  className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-xl transition-colors shadow-md"
                >
                  Assign Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderAssessmentModal()}

    </div>
  );
}
