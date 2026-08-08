import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  getDrafts, 
  generateDrafts, 
  updateDraftContent, 
  updateDraftStatus, 
  getGapReport, 
  getComments, 
  addComment, 
  resolveComment, 
  getIntake, 
  getDocuments,
  getAuditLogs
} from '../services/api';
import { findDrhpNode } from '../data/sebiDrhpSchema';
import { calculateSingleSourceOfTruthReadiness } from '../utils/readinessEngine';

const DraftDocumentContext = createContext();

const MOCK_TRACEABLE_AUDIT_LOGS = [
  {
    id: 'LOG-001',
    timestamp: '2026-08-08 10:42:15 AM',
    actor: 'Rohan Sharma (Lead Merchant Banker)',
    source: 'Reviewer',
    actionType: 'Certification',
    affectedTarget: 'Section I: General Information',
    actionSummary: 'Certified DRHP General Information chapter following statutory diligence approval.',
    prevContent: 'Status: Approved',
    newContent: 'Status: Certified by Rohan Sharma (Merchant Banker Sign-off #MB-2025-089)'
  }
];

export function filterMeaningfulAuditLogs(logs) {
  if (!Array.isArray(logs)) return [];
  
  const filtered = logs.filter(log => {
    if (!log) return false;
    const actionStr = String(log.action || log.actionType || log.event || log.action_type || '').toLowerCase();
    const detailStr = String(log.detail || log.actionSummary || log.description || '').toLowerCase();

    // Noise filtering: remove internal background calculations, readiness scoring loops, autosaves, page refreshes, and polling
    if (
      actionStr.includes('ipo_readiness_computed') ||
      detailStr.includes('ipo_readiness_computed') ||
      actionStr.includes('readiness_computed') ||
      detailStr.includes('readiness_computed') ||
      actionStr.includes('readiness_score') ||
      actionStr.includes('api_poll') ||
      actionStr.includes('fetch_data') ||
      actionStr.includes('autosave_heartbeat') ||
      actionStr.includes('heatmap_recalculated') ||
      actionStr.includes('background_sync')
    ) {
      return false;
    }
    return true;
  });

  // Deduplicate consecutive identical events
  const deduplicated = [];
  const seenKeys = new Set();

  for (const log of filtered) {
    const key = `${log.actor || log.user || ''}_${log.actionType || log.action || ''}_${log.affectedTarget || log.detail || ''}_${log.actionSummary || log.description || ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(log);
    }
  }

  return deduplicated;
}

export function DraftDocumentProvider({ children }) {
  const { user } = useAuth();
  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    if (user?.role === 'issuer' && user?.companyId) return user.companyId;
    return localStorage.getItem('ipo_company_id') || user?.companyId || '';
  });
  const companyId = activeCompanyId;

  // Event listener for company switches & user role updates
  useEffect(() => {
    const syncCompany = () => {
      let targetId = '';
      if (user?.role === 'issuer' && user?.companyId) {
        targetId = user.companyId;
      } else {
        targetId = localStorage.getItem('ipo_company_id') || user?.companyId || '';
      }

      if (targetId !== activeCompanyId) {
        setDrafts({});
        setGapReport([]);
        setComments([]);
        setIntakeCache({});
        setDocsCache([]);
        setAuditLogs([]);
        setActiveCompanyId(targetId);
        if (targetId) localStorage.setItem('ipo_company_id', targetId);
      }
    };

    syncCompany();
    window.addEventListener('ipo-company-changed', syncCompany);
    window.addEventListener('storage', syncCompany);
    return () => {
      window.removeEventListener('ipo-company-changed', syncCompany);
      window.removeEventListener('storage', syncCompany);
    };
  }, [user, activeCompanyId]);

  const [activeTocId, setActiveTocId] = useState('definitions_and_abbreviations');
  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);
  const [comments, setComments] = useState([]);
  const [intakeCache, setIntakeCache] = useState({});
  const [docsCache, setDocsCache] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor and Auto-save state
  const [editorText, setEditorText] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [lastSavedTime, setLastSavedTime] = useState(new Date());
  const autoSaveTimerRef = useRef(null);

  const isCoverPages = activeTocId === 'cover_pages' || activeTocId === 'draft_preview';
  const activeNode = isCoverPages
    ? { section: { id: 'draft_preview', title: 'Draft Preview (Pages 1–3)', key: 'draft_preview', subsections: [] }, key: 'draft_preview', number: '0', fullTitle: 'Draft Preview (Fixed Template — Pages 1–3)' }
    : findDrhpNode(activeTocId);
  const selectedSectionKey = isCoverPages ? 'cover_pages' : (activeNode.key || 'company_details');

  // Real-Time Synchronization Channel
  const syncChannelRef = useRef(null);

  const notifyDraftSync = useCallback(() => {
    try {
      localStorage.setItem('drhp_draft_last_modified', String(Date.now()));
      if (syncChannelRef.current) {
        syncChannelRef.current.postMessage({ type: 'DRAFT_UPDATED', companyId, timestamp: Date.now() });
      }
    } catch (e) {}
  }, [companyId]);

  const loadDraftData = useCallback(async (isSilent = false) => {
    if (!companyId) {
      setDrafts({});
      setComments([]);
      setGapReport([]);
      setIntakeCache({});
      setDocsCache([]);
      setAuditLogs([]);
      setLoading(false);
      return;
    }

    try {
      if (!isSilent) setLoading(true);

      const [draftRes, commRes, gapRes, intakeRes, docsRes] = await Promise.allSettled([
        getDrafts(companyId),
        getComments(selectedSectionKey),
        getGapReport(companyId),
        getIntake(companyId),
        getDocuments(companyId)
      ]);

      if (draftRes.status === 'fulfilled') setDrafts(draftRes.value.data || draftRes.value || {});
      else setDrafts({});
      if (commRes.status === 'fulfilled') setComments(commRes.value.data || commRes.value || []);
      else setComments([]);
      if (gapRes.status === 'fulfilled') setGapReport(gapRes.value.data || gapRes.value || []);
      else setGapReport([]);
      if (intakeRes.status === 'fulfilled') setIntakeCache(intakeRes.value.data || intakeRes.value || {});
      else setIntakeCache({});
      if (docsRes.status === 'fulfilled') setDocsCache(docsRes.value.data || docsRes.value || []);
      else setDocsCache([]);

      try {
        const auditRes = await getAuditLogs(companyId, 1, 50);
        const payload = auditRes.data || auditRes || {};
        const fetchedLogs = payload.logs || payload.data || (Array.isArray(payload) ? payload : []);
        const cleanFetched = filterMeaningfulAuditLogs(fetchedLogs);
        setAuditLogs(cleanFetched || []);
      } catch (auditErr) {
        setAuditLogs([]);
      }
    } catch (err) {
      console.error("Error loading draft workspace data:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [companyId, selectedSectionKey]);

  useEffect(() => {
    loadDraftData();
  }, [companyId, selectedSectionKey, loadDraftData]);

  // Real-time synchronization listener for intake, document & compliance updates
  useEffect(() => {
    const handleReadinessEvent = () => {
      loadDraftData(true);
    };
    window.addEventListener('ipo-readiness-changed', handleReadinessEvent);
    return () => {
      window.removeEventListener('ipo-readiness-changed', handleReadinessEvent);
    };
  }, [loadDraftData]);

  // Real-Time Sync Setup
  useEffect(() => {
    try {
      syncChannelRef.current = new BroadcastChannel('drhp_realtime_sync');
      syncChannelRef.current.onmessage = (event) => {
        if (event.data && event.data.type === 'DRAFT_UPDATED' && event.data.companyId === companyId) {
          loadDraftData(true);
        }
      };
    } catch (e) {}

    const handleStorageChange = (e) => {
      if (e.key === 'drhp_draft_last_modified') {
        loadDraftData(true);
      }
    };
    return () => {
      if (syncChannelRef.current) syncChannelRef.current.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [companyId, selectedSectionKey, loadDraftData]);

  // Auto-Save Content Handler
  const saveContent = useCallback((newText) => {
    setAutoSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const blocks = [{ id: `block-${activeTocId}`, text: newText, confidence: 'high' }];
        await updateDraftContent(companyId, selectedSectionKey, blocks);
        setDrafts(prev => ({
          ...prev,
          [selectedSectionKey]: {
            ...(prev[selectedSectionKey] || {}),
            blocks,
            last_updated: new Date().toISOString()
          }
        }));
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
        notifyDraftSync();
      } catch (err) {
        console.error("Auto-save failed:", err);
        setAutoSaveStatus('unsaved');
      }
    }, 800);
  }, [companyId, selectedSectionKey, activeTocId, notifyDraftSync]);

  // Update Section Status (Approve, Changes Requested, Reject, Lock, Certify)
  const updateSectionStatus = useCallback(async (newStatus, certifiedBy = 'Merchant Banker Lead Manager') => {
    try {
      const certifiedAt = new Date().toISOString();
      await updateDraftStatus(companyId, selectedSectionKey, { 
        status: newStatus,
        role: 'reviewer',
        certified_by: certifiedBy,
        certified_at: certifiedAt
      });
      setDrafts(prev => ({
        ...prev,
        [selectedSectionKey]: {
          ...(prev[selectedSectionKey] || {}),
          status: newStatus,
          certified_by: certifiedBy,
          certified_at: certifiedAt
        }
      }));
      notifyDraftSync();
    } catch (err) {
      console.error("Failed to update section status:", err);
      throw err;
    }
  }, [companyId, selectedSectionKey, notifyDraftSync]);

  // Regenerate Section Content
  const regenerateSection = useCallback(async () => {
    try {
      await generateDrafts(companyId, selectedSectionKey);
      await loadDraftData();
      notifyDraftSync();
    } catch (err) {
      console.error("Regeneration failed:", err);
      throw err;
    }
  }, [companyId, selectedSectionKey, loadDraftData, notifyDraftSync]);

  const postComment = useCallback(async (content, type = 'note', blockId = null) => {
    try {
      const res = await addComment(selectedSectionKey, content, type, blockId);
      const newComm = res.data || res;
      setComments(prev => [...prev, newComm]);
      return newComm;
    } catch (err) {
      console.error("Failed to post comment:", err);
      throw err;
    }
  }, [selectedSectionKey]);

  const resolveCommentById = useCallback(async (commId) => {
    try {
      await resolveComment(commId);
      setComments(prev => prev.map(c => c.id === commId ? { ...c, status: 'resolved' } : c));
    } catch (err) {
      console.error("Failed to resolve comment:", err);
      throw err;
    }
  }, []);

  const readiness = calculateSingleSourceOfTruthReadiness(intakeCache, docsCache, gapReport, drafts);

  const value = {
    companyId,
    activeTocId,
    setActiveTocId,
    isCoverPages,
    activeNode,
    selectedSectionKey,
    drafts,
    setDrafts,
    gapReport,
    comments,
    intakeCache,
    docsCache,
    auditLogs,
    loading,
    editorText,
    setEditorText,
    autoSaveStatus,
    lastSavedTime,
    readiness,
    saveContent,
    updateSectionStatus,
    regenerateSection,
    postComment,
    resolveCommentById,
    loadDraftData
  };

  return (
    <DraftDocumentContext.Provider value={value}>
      {children}
    </DraftDocumentContext.Provider>
  );
}

export function useDraftDocument() {
  const ctx = useContext(DraftDocumentContext);
  if (!ctx) {
    throw new Error('useDraftDocument must be used within a DraftDocumentProvider');
  }
  return ctx;
}
