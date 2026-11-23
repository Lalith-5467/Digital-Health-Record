import { useState, useEffect, useCallback } from 'react';
import { insuranceApi } from '../services/dhrApis';
import { socketService } from '../services/socketService';

export interface InsuranceDocument {
  id: string;
  name: string;
  uploadDate: string;
  uploadedBy: string;
  status: 'Verified' | 'Pending' | 'Rejected' | 'Missing';
}

export interface InsuranceTimelineEvent {
  id: string;
  date: string;
  time: string;
  action: string;
  role: string;
  status: 'Completed' | 'Current' | 'Pending';
}

export interface InsuranceClaim {
  id?: string;
  claimId: string;
  insuranceId: string;
  patientId: string;
  hospital: string;
  treatment: string;
  admissionDate: string;
  dischargeDate: string;
  submittedAmount: number;
  approvedAmount: number;
  patientContribution: number;
  status: 'New' | 'Under Review' | 'Approved' | 'Partially Approved' | 'Rejected' | 'Settled';
  documents: InsuranceDocument[];
  timeline: InsuranceTimelineEvent[];
  preAuthCode?: string;
  settlementTxnId?: string;
  settlementDate?: string;
}

export interface InsurancePolicyRecord {
  id?: string;
  insuranceId: string;
  patientId: string;
  patientName: string;
  policyNumber: string;
  policyName: string;
  policyStatus: 'Active' | 'Inactive' | 'Expired';
  policyStartDate: string;
  policyEndDate: string;
  coverageAmount: number;
  usedCoverage: number;
  remainingCoverage: number;
  benefits: {
    hospitalization: 'Covered' | 'Partial' | 'Not Covered';
    emergency: 'Covered' | 'Partial' | 'Not Covered';
    consultation: 'Covered' | 'Partial' | 'Not Covered';
    diagnostics: 'Covered' | 'Partial' | 'Not Covered';
    medicines: 'Covered' | 'Partial' | 'Not Covered';
    nursing: 'Covered' | 'Partial' | 'Not Covered';
  };
  claims: InsuranceClaim[];
  currentClaim: InsuranceClaim | null;
  policyDocuments?: InsuranceDocument[];
}

function mapBackendClaim(c: any, policyInsuranceId: string, patientAbhaOrId: string): InsuranceClaim {
  let docs: InsuranceDocument[] = [];
  if (c.documents) {
    try {
      const parsed = typeof c.documents === 'string' ? JSON.parse(c.documents) : c.documents;
      if (Array.isArray(parsed)) docs = parsed;
    } catch {}
  }
  let timeline: InsuranceTimelineEvent[] = [];
  if (c.timeline) {
    try {
      const parsed = typeof c.timeline === 'string' ? JSON.parse(c.timeline) : c.timeline;
      if (Array.isArray(parsed)) timeline = parsed;
    } catch {}
  }
  const firstSettlement = Array.isArray(c.settlements) ? c.settlements[0] : null;
  return {
    id: c.id,
    claimId: c.claimId || c.id,
    insuranceId: policyInsuranceId,
    patientId: patientAbhaOrId,
    hospital: c.hospital || 'Network Hospital',
    treatment: c.treatment || 'Medical Treatment',
    admissionDate: c.admissionDate
      ? new Date(c.admissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    dischargeDate: c.dischargeDate
      ? new Date(c.dischargeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    submittedAmount: Number(c.submittedAmount ?? 0),
    approvedAmount: Number(c.approvedAmount ?? 0),
    patientContribution: Number(c.patientContribution ?? 0),
    status: (c.status || 'Under Review') as InsuranceClaim['status'],
    documents: docs,
    timeline,
    settlementTxnId: firstSettlement?.referenceNumber || firstSettlement?.settlementId || undefined,
    settlementDate: firstSettlement?.settlementDate
      ? new Date(firstSettlement.settlementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : undefined,
  };
}

function mapBackendPolicy(p: any): InsurancePolicyRecord {
  let benefits = {
    hospitalization: 'Covered' as const,
    emergency: 'Covered' as const,
    consultation: 'Covered' as const,
    diagnostics: 'Covered' as const,
    medicines: 'Partial' as const,
    nursing: 'Covered' as const,
  };
  if (p.benefits) {
    try {
      const parsed = typeof p.benefits === 'string' ? JSON.parse(p.benefits) : p.benefits;
      if (parsed && typeof parsed === 'object') benefits = { ...benefits, ...parsed };
    } catch {}
  }
  const patientAbha = p.patient?.user?.abhaId || p.patientId || '';
  const claims: InsuranceClaim[] = Array.isArray(p.claims)
    ? p.claims.map((c: any) => mapBackendClaim(c, p.insuranceId, patientAbha))
    : [];
  const activeClaim = claims.find((c) => c.status !== 'Settled') || claims[0] || null;
  const policyDocuments: InsuranceDocument[] = Array.isArray(p.documents)
    ? p.documents.map((d: any) => ({
        id: d.id,
        name: d.title || 'Policy Document',
        uploadDate: d.uploadedAt
          ? new Date(d.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—',
        uploadedBy: d.docType || 'Policy Holder',
        status: (d.status || 'Pending') as InsuranceDocument['status'],
      }))
    : [];

  return {
    id: p.id,
    insuranceId: p.insuranceId || p.policyNumber || p.id,
    patientId: patientAbha,
    patientName: p.patient?.fullName || 'Policy Holder',
    policyNumber: p.policyNumber || p.insuranceId,
    policyName: p.policyName || 'Health Insurance Plan',
    policyStatus: (p.policyStatus || 'Active') as InsurancePolicyRecord['policyStatus'],
    policyStartDate: p.policyStartDate
      ? new Date(p.policyStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    policyEndDate: p.policyEndDate
      ? new Date(p.policyEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    coverageAmount: Number(p.coverageAmount ?? 0),
    usedCoverage: Number(p.usedCoverage ?? 0),
    remainingCoverage: Number(p.remainingCoverage ?? 0),
    benefits,
    claims,
    currentClaim: activeClaim,
    policyDocuments,
  };
}

async function fetchRecordsFromDb(): Promise<InsurancePolicyRecord[]> {
  try {
    const res = await insuranceApi.getPolicies();
    if (res?.data && Array.isArray(res.data)) {
      return res.data.map(mapBackendPolicy);
    }
  } catch (err) {
    console.error('Failed to fetch insurance policies from MySQL:', err);
  }
  return [];
}

export const useInsuranceWorkflow = () => {
  const [records, setRecords] = useState<InsurancePolicyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadRecords = useCallback(async () => {
    try {
      const live = await fetchRecordsFromDb();
      setRecords(live);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    const handleSync = () => loadRecords();
    window.addEventListener('medicare_sync_insurance', handleSync);
    window.addEventListener('focus', handleSync);

    let unsub: (() => void) | undefined;
    try {
      socketService.connect();
      if (typeof (socketService as any).subscribeToInsuranceUpdates === 'function') {
        unsub = (socketService as any).subscribeToInsuranceUpdates(() => loadRecords());
      }
    } catch {}

    return () => {
      window.removeEventListener('medicare_sync_insurance', handleSync);
      window.removeEventListener('focus', handleSync);
      if (unsub) unsub();
    };
  }, [loadRecords]);

  const triggerSync = () => {
    window.dispatchEvent(new Event('medicare_sync_insurance'));
  };

  const searchPolicy = (query: string): InsurancePolicyRecord | undefined => {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    return records.find(
      (r) =>
        r.insuranceId.toLowerCase().includes(q) ||
        r.policyNumber.toLowerCase().includes(q) ||
        r.patientName.toLowerCase().includes(q) ||
        r.patientId.toLowerCase().includes(q)
    );
  };

  const submitPatientClaim = async (
    insuranceIdOrPayload:
      | string
      | {
          claimId?: string;
          insuranceId: string;
          patientName?: string;
          hospital: string;
          treatment: string;
          submittedAmount: number;
          admissionDate?: string;
          dischargeDate?: string;
          attachedFiles?: string[];
          documents?: InsuranceDocument[];
        },
    claimDataArg?: {
      hospital: string;
      treatment: string;
      submittedAmount: number;
      admissionDate?: string;
      dischargeDate?: string;
      documents?: InsuranceDocument[];
    }
  ): Promise<string> => {
    const payload =
      typeof insuranceIdOrPayload === 'string'
        ? { insuranceId: insuranceIdOrPayload, ...(claimDataArg || ({} as any)) }
        : insuranceIdOrPayload;

    const targetPolicy = records.find((r) => r.insuranceId === payload.insuranceId || r.id === payload.insuranceId);
    const docs =
      payload.documents ||
      (Array.isArray((payload as any).attachedFiles)
        ? (payload as any).attachedFiles.map((f: string, idx: number) => ({
            id: `doc-${idx + 1}`,
            name: f,
            uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            uploadedBy: 'Patient',
            status: 'Pending',
          }))
        : []);

    const res = await insuranceApi.createClaim({
      claimId: (payload as any).claimId,
      policyId: targetPolicy?.id,
      insuranceId: payload.insuranceId,
      hospital: payload.hospital,
      treatment: payload.treatment,
      submittedAmount: payload.submittedAmount,
      admissionDate: payload.admissionDate,
      dischargeDate: payload.dischargeDate,
      documents: docs,
    });
    await loadRecords();
    triggerSync();
    return (res?.data as any)?.claimId || (res?.data as any)?.id || '';
  };

  const updateCurrentClaimStatus = async (
    insuranceId: string,
    status: InsuranceClaim['status'],
    approvedAmount?: number,
    timelineAction?: string
  ) => {
    const updated = await updateInsuranceClaimStatus(insuranceId, status, approvedAmount, timelineAction);
    setRecords(updated);
    triggerSync();
  };

  const updateDocumentStatus = async (insuranceId: string, docId: string, status: InsuranceDocument['status']) => {
    try {
      await insuranceApi.updateDocumentStatus(docId, status);
      await loadRecords();
      triggerSync();
    } catch (err) {
      // If this docId belongs to a claim's embedded documents JSON rather than InsuranceDocument table,
      // persist a verification audit update on the claim itself if possible, otherwise rethrow.
      const target = records.find((r) => r.insuranceId === insuranceId);
      if (target?.currentClaim && target.currentClaim.documents.some((d) => d.id === docId)) {
        const docName = target.currentClaim.documents.find((d) => d.id === docId)?.name || docId;
        await insuranceApi.updateClaimStatus(target.currentClaim.claimId, {
          status: target.currentClaim.status,
          reason: `Document "${docName}" marked ${status}`,
        });
        await loadRecords();
        triggerSync();
        return;
      }
      throw err;
    }
  };

  return {
    records,
    loading,
    refreshRecords: loadRecords,
    searchPolicy,
    submitPatientClaim,
    updateCurrentClaimStatus,
    updateDocumentStatus,
  };
};

export const getStoredInsuranceRecords = (): InsurancePolicyRecord[] => [];

export const updateInsuranceClaimStatus = async (
  insuranceIdOrClaimId: string,
  status: InsuranceClaim['status'],
  approvedAmount?: number,
  timelineAction?: string
): Promise<InsurancePolicyRecord[]> => {
  const currentRecords = await fetchRecordsFromDb();
  const targetPolicy = currentRecords.find(
    (r) =>
      r.insuranceId === insuranceIdOrClaimId ||
      r.currentClaim?.claimId === insuranceIdOrClaimId ||
      r.claims.some((c) => c.claimId === insuranceIdOrClaimId)
  );
  const claimId =
    targetPolicy?.claims.find((c) => c.claimId === insuranceIdOrClaimId)?.claimId ||
    targetPolicy?.currentClaim?.claimId ||
    insuranceIdOrClaimId;

  await insuranceApi.updateClaimStatus(claimId, {
    status,
    approvedAmount,
    reason: timelineAction,
  });

  const refreshed = await fetchRecordsFromDb();
  window.dispatchEvent(new Event('medicare_sync_insurance'));
  window.dispatchEvent(new Event('notifications_updated'));
  return refreshed;
};
