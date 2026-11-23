import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../ui/PageHeader';
import { useLanguage } from '../../context/LanguageContext';
import {
  ShieldCheck,
  Plus,
  FileText,
  CheckCircle2,
  Users,
  CreditCard,
  Layers,
  Sparkles,
  HelpCircle,
  Clock
} from 'lucide-react';
import type {
  InsurancePolicy,
  InsuranceClaim,
  InsuranceDocument,
  FamilyMemberCoverage,
  PremiumPaymentRecord,
  InsuranceFilterState
} from './insuranceData';
import { PrimaryPolicyHeroCard } from './PrimaryPolicyHeroCard';
import { CoverageOverviewSection } from './CoverageOverviewSection';
import { CoverageDetailsModal } from './CoverageDetailsModal';
import { AddPolicyModal } from './AddPolicyModal';
import { EditPolicyModal } from './EditPolicyModal';
import { ClaimsOverviewSection } from './ClaimsOverviewSection';
import { ClaimDetailsDrawer } from './ClaimDetailsDrawer';
import { NewClaimModal } from './NewClaimModal';
import { DigitalHealthCardModal } from './DigitalHealthCardModal';
import { FamilyCoverageSection } from './FamilyCoverageSection';
import { AddFamilyMemberModal } from './AddFamilyMemberModal';
import { PremiumPaymentsSection } from './PremiumPaymentsSection';
import { PolicyRenewalCard } from './PolicyRenewalCard';
import { PlanExplorerModal } from './PlanExplorerModal';
import { InsuranceDocumentsSection } from './InsuranceDocumentsSection';
import { InsuranceSupportModal } from './InsuranceSupportModal';
import { InsuranceFAQSection } from './InsuranceFAQSection';
import { InsuranceFilterDrawer } from './InsuranceFilterDrawer';
import { LiveClaimTimelineTracker } from './LiveClaimTimelineTracker';
import { useInsuranceWorkflow } from '../../utils/insuranceWorkflowStorage';
import { insuranceApi, reminderApi } from '../../services/dhrApis';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  abhaId: string;
  bloodGroup: string;
  age: number;
}

interface InsuranceViewProps {
  user?: UserProfile;
  onNavigate: (page: string) => void;
}

export const InsuranceView: React.FC<InsuranceViewProps> = ({
  user,
  onNavigate: _onNavigate,
}) => {
  const { t } = useLanguage();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'claims' | 'family' | 'documents'>('overview');

  // MAIN STATE (Hydrated from MySQL)
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [documents, setDocuments] = useState<InsuranceDocument[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberCoverage[]>([]);
  const [payments, setPayments] = useState<PremiumPaymentRecord[]>([]);

  // SEARCH & FILTERS
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<InsuranceFilterState>({
    policyStatus: 'All',
    claimStatus: 'All',
    docCategory: 'All'
  });

  // MODALS & DRAWERS
  const [coverageDetailsOpen, setCoverageDetailsOpen] = useState(false);
  const [addPolicyOpen, setAddPolicyOpen] = useState(false);
  const [editPolicyTarget, setEditPolicyTarget] = useState<InsurancePolicy | null>(null);
  const [claimDetailsTarget, setClaimDetailsTarget] = useState<InsuranceClaim | null>(null);
  const [newClaimOpen, setNewClaimOpen] = useState(false);
  const [digitalCardOpen, setDigitalCardOpen] = useState(false);
  const [addFamilyMemberOpen, setAddFamilyMemberOpen] = useState(false);
  const [planExplorerOpen, setPlanExplorerOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const { records, submitPatientClaim, refreshRecords } = useInsuranceWorkflow();

  const loadDbInsuranceDetails = async () => {
    try {
      const [polRes, docsRes, famRes, payRes] = await Promise.all([
        insuranceApi.getPolicies().catch(() => null),
        insuranceApi.getDocuments().catch(() => null),
        insuranceApi.getFamilyMembers().catch(() => null),
        insuranceApi.getPremiumPayments().catch(() => null),
      ]);

      if (polRes?.data && Array.isArray(polRes.data)) {
        const mappedPols: InsurancePolicy[] = polRes.data.map((p: any, idx: number) => ({
          id: p.id,
          providerName: p.provider?.providerName || 'Health Insurance Desk',
          planName: p.policyName || 'Comprehensive Health Shield',
          policyNumber: p.policyNumber || p.insuranceId,
          policyHolder: p.patient?.fullName || user?.name || 'Policy Holder',
          policyType: 'Family Floater',
          startDate: p.policyStartDate ? new Date(p.policyStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          expiryDate: p.policyEndDate ? new Date(p.policyEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          coverageAmount: Number(p.coverageAmount ?? 1000000),
          usedAmount: Number(p.usedCoverage ?? 0),
          remainingAmount: Number(p.remainingCoverage ?? p.coverageAmount ?? 1000000),
          premiumAmount: 2450,
          premiumFrequency: 'Monthly',
          status: (p.policyStatus || 'Active') as any,
          memberId: p.insuranceId || p.policyNumber,
          isPrimary: idx === 0,
        }));
        setPolicies(mappedPols);
      }

      if (docsRes?.data && Array.isArray(docsRes.data)) {
        setDocuments(
          docsRes.data.map((d: any) => ({
            id: d.id,
            fileName: d.title,
            category: (d.docType || 'Policy Document') as any,
            dateAdded: d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            fileSize: d.fileSize || 'PDF',
          }))
        );
      }

      if (famRes?.data && Array.isArray(famRes.data)) {
        setFamilyMembers(
          famRes.data.map((m: any) => ({
            id: m.id,
            memberName: m.name,
            relationship: (m.relationship || 'Spouse') as any,
            status: (m.status || 'Covered') as any,
            coverageLimit: 500000,
            usedAmount: 0,
          }))
        );
      }

      if (payRes?.data && Array.isArray(payRes.data)) {
        setPayments(
          payRes.data.map((py: any) => ({
            id: py.id,
            monthYear: py.paidAt ? new Date(py.paidAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Paid',
            amount: Number(py.amount ?? 0),
            paymentDate: py.paidAt ? new Date(py.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            status: (py.status || 'Paid') as any,
            receiptNumber: py.transactionRef || py.id.slice(-8).toUpperCase(),
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load insurance details from MySQL:', e);
    }
  };

  useEffect(() => {
    loadDbInsuranceDetails();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const safePolicies = policies;
  const primaryPolicy: InsurancePolicy | null = safePolicies.find((p) => p.isPrimary) || safePolicies[0] || null;
  const totalSumInsured = safePolicies.reduce((sum, p) => sum + (Number(p.coverageAmount) || 0), 0);

  const handleAddPolicy = async (newPol: InsurancePolicy) => {
    try {
      await insuranceApi.createPolicy({
        policyNumber: newPol.policyNumber,
        policyName: newPol.planName,
        coverageAmount: newPol.coverageAmount,
        usedCoverage: newPol.usedAmount || 0,
        policyStatus: newPol.status || 'Active',
      });
      await loadDbInsuranceDetails();
      await refreshRecords();
      showToast(`✓ Policy ${newPol.planName} saved to MySQL`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save policy');
    }
  };

  const handleSavePolicy = async (updatedPol: InsurancePolicy) => {
    try {
      await insuranceApi.updatePolicy(updatedPol.id, {
        policyName: updatedPol.planName,
        coverageAmount: updatedPol.coverageAmount,
        usedCoverage: updatedPol.usedAmount,
        policyStatus: updatedPol.status,
      });
      await loadDbInsuranceDetails();
      await refreshRecords();
      showToast(`✓ Updated policy details for ${updatedPol.planName}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update policy');
    }
  };

  const patientDisplayName = React.useMemo(() => {
    if (user?.name && user.name.trim() && user.name.toLowerCase() !== 'patient') {
      return user.name.trim();
    }
    if (primaryPolicy?.policyHolder && primaryPolicy.policyHolder.trim()) {
      return primaryPolicy.policyHolder.trim();
    }
    return user?.name || 'Patient';
  }, [user?.name, primaryPolicy?.policyHolder]);

  const prevStatusRef = useRef<string | null>(null);

  // Sync claims when insurance incharge reviews or settles claims
  useEffect(() => {
    const primaryRecord = records.find(r => 
      (user?.name && r.patientName.toLowerCase() === user.name.toLowerCase()) ||
      (patientDisplayName && r.patientName.toLowerCase() === patientDisplayName.toLowerCase()) ||
      (primaryPolicy?.id && r.insuranceId === primaryPolicy.id) ||
      (primaryPolicy?.policyNumber && r.policyNumber === primaryPolicy.policyNumber)
    ) || records.find(r => r.currentClaim !== null) || records[0];

    if (primaryRecord) {
      const activeStatus = primaryRecord.currentClaim?.status;
      if (prevStatusRef.current && prevStatusRef.current !== activeStatus) {
        if (activeStatus === 'Approved') {
          showToast(`🎉 Cashless Pre-Auth Approved! Code: ${primaryRecord.currentClaim?.preAuthCode || 'AUTH-84920-APOLLO'}`);
        } else if (activeStatus === 'Settled') {
          showToast(`✓ Cashless Payout Settled directly with ${primaryRecord.currentClaim?.hospital}! Zero patient dues.`);
        } else if (activeStatus === 'Rejected') {
          showToast(`Insurance review updated: Claim declined. See reason in tracker.`);
        }
      }
      prevStatusRef.current = activeStatus || null;
      const syncedClaims: InsuranceClaim[] = [];
      
      if (primaryRecord.currentClaim) {
        syncedClaims.push({
          id: primaryRecord.currentClaim.claimId,
          claimNumber: primaryRecord.currentClaim.claimId,
          hospitalName: primaryRecord.currentClaim.hospital,
          treatmentType: (primaryRecord.currentClaim.treatment as any) || 'Hospitalization',
          submittedDate: primaryRecord.currentClaim.admissionDate,
          claimedAmount: primaryRecord.currentClaim.submittedAmount,
          approvedAmount: primaryRecord.currentClaim.approvedAmount,
          status: primaryRecord.currentClaim.status === 'Under Review' ? 'Under Review' : primaryRecord.currentClaim.status === 'Approved' ? 'Approved' : primaryRecord.currentClaim.status === 'Rejected' ? 'Rejected' : 'Pending',
          documentsAttached: primaryRecord.currentClaim.documents.map(d => d.name),
          timeline: primaryRecord.currentClaim.timeline.map(t => ({
            stage: t.action,
            date: `${t.date} ${t.time}`,
            completed: t.status === 'Completed',
            active: t.status === 'Current'
          }))
        });
      }

      primaryRecord.claims.forEach(c => {
        syncedClaims.push({
          id: c.claimId,
          claimNumber: c.claimId,
          hospitalName: c.hospital,
          treatmentType: (c.treatment as any) || 'Hospitalization',
          submittedDate: c.admissionDate,
          claimedAmount: c.submittedAmount,
          approvedAmount: c.approvedAmount,
          status: c.status === 'Settled' || c.status === 'Approved' ? 'Approved' : c.status === 'Rejected' ? 'Rejected' : 'Under Review',
          documentsAttached: c.documents.map(d => d.name),
          timeline: c.timeline.map(t => ({
            stage: t.action,
            date: `${t.date} ${t.time}`,
            completed: t.status === 'Completed',
            active: t.status === 'Current'
          }))
        });
      });

      if (syncedClaims.length > 0) {
        setClaims(syncedClaims);
      }
    }
  }, [records, patientDisplayName, primaryPolicy]);

  const handleOpenInsurancePortal = () => {
    window.history.pushState(null, '', '/insurance/overview');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleAddClaim = async (newClaim: InsuranceClaim) => {
    const cardId = primaryPolicy?.policyNumber || primaryPolicy?.id || `INS-MC-${new Date().getFullYear()}`;
    try {
      await submitPatientClaim({
        claimId: newClaim.claimNumber || newClaim.id,
        insuranceId: cardId,
        patientName: patientDisplayName,
        hospital: newClaim.hospitalName,
        treatment: newClaim.treatmentType,
        submittedAmount: newClaim.claimedAmount,
        attachedFiles: newClaim.documentsAttached,
      });
      await loadDbInsuranceDetails();
      showToast(`✓ Claim ${newClaim.claimNumber} saved to database & dispatched to Insurance Portal`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit claim');
    }
  };

  const handleAddFamilyMember = async (newMem: FamilyMemberCoverage) => {
    if (!policies[0]?.id) {
      showToast('Please add an insurance policy first.');
      return;
    }
    try {
      await insuranceApi.addFamilyMember({
        policyId: policies[0].id,
        name: newMem.memberName,
        relationship: newMem.relationship,
      });
      await loadDbInsuranceDetails();
      showToast(`✓ Added ${newMem.memberName} to Family Floater Policy`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to add family member');
    }
  };

  const handlePayPremium = () => {
    setPayModalOpen(true);
  };

  const confirmPayPremium = async () => {
    if (!primaryPolicy?.id) {
      setPayModalOpen(false);
      showToast('Please register a policy before recording a premium payment.');
      return;
    }
    try {
      const amount = primaryPolicy ? primaryPolicy.premiumAmount : 2450;
      await insuranceApi.recordPremiumPayment({
        policyId: primaryPolicy.id,
        amount,
        paymentMethod: 'UPI',
      });
      await loadDbInsuranceDetails();
      setPayModalOpen(false);
      showToast(`✓ Premium payment of ₹${amount} saved to database`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to record premium payment');
    }
  };

  const handleUploadDocument = async (doc: InsuranceDocument) => {
    if (!primaryPolicy?.id) {
      showToast('Please link or add an insurance policy before uploading documents.');
      return;
    }
    try {
      await insuranceApi.addDocument({
        policyId: primaryPolicy.id,
        title: doc.fileName,
        docType: doc.category,
        fileSize: doc.fileSize,
      });
      await loadDbInsuranceDetails();
      showToast(`✓ Uploaded & saved ${doc.fileName} to database`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload document');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await insuranceApi.deleteDocument(id);
      await loadDbInsuranceDetails();
      showToast('✓ Document removed from database');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete document');
    }
  };

  const handleRenewPolicy = async () => {
    if (!primaryPolicy?.id) {
      showToast('Please add a policy first.');
      return;
    }
    try {
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await insuranceApi.updatePolicy(primaryPolicy.id, {
        policyStatus: 'Active',
        policyEndDate: nextYear,
      });
      await loadDbInsuranceDetails();
      await refreshRecords();
      showToast(`✓ Policy ${primaryPolicy.planName} renewed for 1 year`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to renew policy');
    }
  };

  const handleSetRenewalReminder = async () => {
    if (!primaryPolicy) return;
    try {
      await reminderApi.createReminder({
        title: `Renew Insurance Policy: ${primaryPolicy.planName}`,
        type: 'INSURANCE',
        scheduledTime: '09:00',
        frequency: 'Once',
        notes: `Policy #${primaryPolicy.policyNumber} expires on ${primaryPolicy.expiryDate}`,
      });
      showToast('✓ Policy renewal reminder saved');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create renewal reminder');
    }
  };

  const handleSelectMarketplacePlan = async (plan: any) => {
    try {
      await insuranceApi.createPolicy({
        policyName: plan.name,
        coverageAmount: Number(plan.coverageAmount || 500000),
        policyStatus: 'Active',
      });
      await loadDbInsuranceDetails();
      await refreshRecords();
      setPlanExplorerOpen(false);
      showToast(`✓ Linked plan ${plan.name} to your account`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to add selected plan');
    }
  };

  const handleSubmitSupportTicket = async (topic: string, message: string) => {
    if (!primaryPolicy?.id) {
      showToast('Please add an insurance policy before submitting a support/pre-auth request.');
      return;
    }
    try {
      await insuranceApi.createPreAuthorization({
        policyId: primaryPolicy.id,
        hospitalName: 'Insurance Support Desk',
        procedure: topic,
        diagnosis: message,
        requestType: 'Support',
        estimatedCost: 0,
        requestedAmount: 0,
      });
      showToast(`✓ Support request submitted: ${topic}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit support request');
    }
  };

  const tabList = [
    { id: 'overview', label: t('insurance.view_coverage', 'Policy & Coverage'), icon: ShieldCheck, badge: `${safePolicies.length} Active` },
    { id: 'claims', label: t('insurance.claim_tracker', 'Claims & History'), icon: FileText, badge: `${claims.length} Claims` },
    { id: 'family', label: t('family.title', 'Family & Payments'), icon: Users, badge: `${familyMembers.length} Members` },
    { id: 'documents', label: t('settings.support', 'Vault & Support'), icon: Layers, badge: `${documents.length} Docs` },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-20 font-sans">
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

      {/* 1. PAGE HEADER */}
      <PageHeader
        title={t('insurance.title', 'Insurance & Policy Portal')}
        subtitle={t('insurance.subtitle', 'Manage your health coverage breakdown, digital cashless cards, family floater, and claims.')}
        badgeText={t('card.covered', 'Active Coverage')}
        badgeIcon={<ShieldCheck className="w-3.5 h-3.5" />}
        rightElement={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSupportModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">{t('settings.support', 'Insurance Support')}</span>
            </button>
            <button
              onClick={() => setAddPolicyOpen(true)}
              className="px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-[#00a896] hover:bg-[#00897b] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('insurance.new_claim', 'Add Insurance')}</span>
            </button>
          </div>
        }
      />

      {/* 2. FOUR SUMMARY CARDS WITH ACCENT COLORS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          className="p-4 rounded-2xl flex items-center gap-3.5 bg-gradient-to-br from-[#f0fdfa] to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-teal-500/20 dark:border-teal-500/10 shadow-[0_2px_10px_rgba(20,184,166,.05)] dark:shadow-none"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-900 dark:text-white shrink-0 bg-gradient-to-br from-[#00a896] to-teal-600 shadow-[0_3px_10px_rgba(0,168,150,.3)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('insurance.active_policy', 'Active Policies')}</span>
            <strong className="text-xl font-black text-slate-900 dark:text-white">{safePolicies.length}</strong>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl flex items-center gap-3.5 bg-gradient-to-br from-[#eff6ff] to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-blue-500/20 dark:border-blue-500/10 shadow-[0_2px_10px_rgba(59,130,246,.05)] dark:shadow-none"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-900 dark:text-white shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_3px_10px_rgba(59,130,246,.3)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('insurance.sum_insured', 'Total Sum Insured')}</span>
            <strong className="text-xl font-black text-blue-700 dark:text-blue-400">
              {totalSumInsured > 0 ? `₹${(totalSumInsured / 100000).toFixed(1)} Lakhs` : '₹0'}
            </strong>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl flex items-center gap-3.5 bg-gradient-to-br from-[#f0fdf4] to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-emerald-500/20 dark:border-emerald-500/10 shadow-[0_2px_10px_rgba(16,185,129,.05)] dark:shadow-none"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-900 dark:text-white shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_3px_10px_rgba(16,185,129,.3)]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('insurance.claim_tracker', 'Claims Handled')}</span>
            <strong className="text-xl font-black text-emerald-700 dark:text-emerald-400">{claims.length}</strong>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl flex items-center gap-3.5 bg-gradient-to-br from-[#fdf4ff] to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-purple-500/20 dark:border-purple-500/10 shadow-[0_2px_10px_rgba(192,132,252,.05)] dark:shadow-none"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-slate-900 dark:text-white shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 shadow-[0_3px_10px_rgba(168,85,247,.3)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('records.title', 'Vault Documents')}</span>
            <strong className="text-xl font-black text-purple-700 dark:text-purple-400">{documents.length}</strong>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 overflow-x-auto">
        {tabList.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-[#00a896] dark:text-cyan-300 shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                  isActive
                    ? 'bg-teal-500/15 text-[#00a896]'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENT */}

      {/* TAB 1: OVERVIEW & POLICIES */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* LIVE CLAIM REAL-TIME TIMELINE TRACKER */}
          {primaryPolicy && (
            <LiveClaimTimelineTracker 
              onOpenNewClaim={() => setNewClaimOpen(true)}
              patientInsuranceId={primaryPolicy.memberId || primaryPolicy.policyNumber || primaryPolicy.id}
              userName={patientDisplayName}
            />
          )}

          {/* EMPTY STATE WHEN NO POLICIES EXIST */}
          {safePolicies.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-[#00a896] flex items-center justify-center mx-auto border border-teal-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  No insurance policies linked yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Link your active health insurance policy or explore coverage plans to enable cashless claims, digital health cards, and family floater management.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setAddPolicyOpen(true)}
                  className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-[#00a896] hover:bg-[#00897b] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Policy</span>
                </button>
                <button
                  onClick={() => setPlanExplorerOpen(true)}
                  className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-[#00a896] bg-teal-50 dark:bg-slate-800 hover:bg-teal-100 border border-teal-200/60 dark:border-slate-700 transition-all cursor-pointer"
                >
                  Explore Plans Marketplace →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Primary Hero Card */}
              {primaryPolicy && (
                <PrimaryPolicyHeroCard
                  policy={primaryPolicy}
                  onOpenDigitalCard={() => setDigitalCardOpen(true)}
                  onOpenEditPolicy={(p) => setEditPolicyTarget(p)}
                  onOpenCoverageDetails={() => setCoverageDetailsOpen(true)}
                />
              )}

              {/* Coverage Overview with Progress */}
              {primaryPolicy && (
                <CoverageOverviewSection
                  policy={primaryPolicy}
                  onOpenDetails={() => setCoverageDetailsOpen(true)}
                />
              )}

              {/* My Policies List */}
              <div className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    All Linked Policies ({safePolicies.length})
                  </h3>
                  <button
                    onClick={() => setPlanExplorerOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-50 dark:bg-slate-800 hover:bg-teal-100 text-[#00a896] dark:text-cyan-300 font-extrabold border border-teal-200/60 dark:border-slate-700 cursor-pointer shadow-xs"
                  >
                    Explore Plans Marketplace →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {safePolicies.map((pol) => (
                    <div
                      key={pol.id}
                      className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs hover:border-teal-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-extrabold text-teal-700 dark:text-teal-400 uppercase font-mono">
                            {pol.policyType}
                          </span>
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5">{pol.planName}</h4>
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{pol.providerName}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                          {pol.status}
                        </span>
                      </div>

                      <div className="flex justify-between font-mono text-[11px] pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          Coverage: <strong className="text-slate-900 dark:text-white">₹{pol.coverageAmount.toLocaleString()}</strong>
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          ₹{pol.premiumAmount}/{pol.premiumFrequency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Renewal Alert Card */}
              {primaryPolicy && (
                <PolicyRenewalCard
                  policy={primaryPolicy}
                  onRenewClick={handleRenewPolicy}
                  onSetReminderClick={handleSetRenewalReminder}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS & REIMBURSEMENTS */}
      {activeTab === 'claims' && (
        <div className="space-y-6">
          {/* LIVE CLAIM REAL-TIME TIMELINE TRACKER */}
          {primaryPolicy && (
            <LiveClaimTimelineTracker 
              onOpenNewClaim={() => setNewClaimOpen(true)}
              patientInsuranceId={primaryPolicy.memberId || primaryPolicy.policyNumber || primaryPolicy.id}
              userName={patientDisplayName}
            />
          )}

          <ClaimsOverviewSection
            claims={claims}
            onOpenNewClaim={() => setNewClaimOpen(true)}
            onOpenClaimDetails={(c) => setClaimDetailsTarget(c)}
          />
        </div>
      )}

      {/* TAB 3: FAMILY COVERAGE & PAYMENTS */}
      {activeTab === 'family' && (
        <div className="space-y-6">
          <FamilyCoverageSection
            members={familyMembers}
            onOpenAddMember={() => setAddFamilyMemberOpen(true)}
          />

          <PremiumPaymentsSection
            payments={payments}
            onPayNextPremium={handlePayPremium}
          />
        </div>
      )}

      {/* TAB 4: VAULT DOCUMENTS & FAQ */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <InsuranceDocumentsSection
            documents={documents}
            onUploadDocument={handleUploadDocument}
            onDeleteDocument={handleDeleteDocument}
          />

          <InsuranceFAQSection />
        </div>
      )}

      {/* MODALS & DRAWERS */}
      <CoverageDetailsModal
        policy={primaryPolicy}
        isOpen={coverageDetailsOpen}
        onClose={() => setCoverageDetailsOpen(false)}
      />

      <AddPolicyModal
        isOpen={addPolicyOpen}
        onClose={() => setAddPolicyOpen(false)}
        onAddPolicy={handleAddPolicy}
        defaultHolderName={patientDisplayName}
      />

      <EditPolicyModal
        policy={editPolicyTarget}
        isOpen={!!editPolicyTarget}
        onClose={() => setEditPolicyTarget(null)}
        onSavePolicy={handleSavePolicy}
      />

      <ClaimDetailsDrawer
        claim={claimDetailsTarget}
        isOpen={!!claimDetailsTarget}
        onClose={() => setClaimDetailsTarget(null)}
      />

      <NewClaimModal
        isOpen={newClaimOpen}
        onClose={() => setNewClaimOpen(false)}
        onAddClaim={handleAddClaim}
        onOpenInsurancePortal={handleOpenInsurancePortal}
        patientName={patientDisplayName}
        insuranceId={primaryPolicy?.memberId || primaryPolicy?.policyNumber || primaryPolicy?.id || ''}
      />

      <DigitalHealthCardModal
        policy={primaryPolicy}
        isOpen={digitalCardOpen}
        onClose={() => setDigitalCardOpen(false)}
        onShareCard={() => {
          showToast('✓ Shared digital health card');
          setDigitalCardOpen(false);
        }}
      />

      <AddFamilyMemberModal
        isOpen={addFamilyMemberOpen}
        onClose={() => setAddFamilyMemberOpen(false)}
        onAddMember={handleAddFamilyMember}
      />

      <PlanExplorerModal
        isOpen={planExplorerOpen}
        onClose={() => setPlanExplorerOpen(false)}
        onSelectPlan={handleSelectMarketplacePlan}
      />

      <InsuranceSupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        onSubmitSupport={handleSubmitSupportTicket}
      />

      <InsuranceFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        onApplyFilters={(updated) => setFilters(updated)}
      />

      {/* DEMO PAY MODAL */}
      {payModalOpen && primaryPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs text-slate-900 dark:text-white">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Pay Policy Premium</h3>
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Plan:</span>
                <strong className="text-slate-900 dark:text-white">{primaryPolicy.planName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Premium Due:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-extrabold">₹{primaryPolicy.premiumAmount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Policy Valid Until:</span>
                <strong className="text-amber-600 dark:text-amber-300">{primaryPolicy.expiryDate}</strong>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 font-sans">
              <button
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayPremium}
                className="flex-1 py-2.5 rounded-xl bg-[#00a896] hover:bg-[#00897b] text-white font-extrabold cursor-pointer text-center shadow-md"
              >
                Confirm Payment (₹{primaryPolicy.premiumAmount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
