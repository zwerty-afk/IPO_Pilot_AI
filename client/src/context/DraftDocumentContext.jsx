import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

const DraftDocumentContext = createContext();

export function DraftDocumentProvider({ children }) {
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

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
    try {
      if (!isSilent) setLoading(true);

      const draftRes = await getDrafts(companyId);
      const draftData = draftRes.data || draftRes || {};
      setDrafts(draftData);

      const commRes = await getComments(selectedSectionKey);
      setComments(commRes.data || commRes || []);

      if (!isSilent) {
        const gapRes = await getGapReport(companyId);
        setGapReport(gapRes.data || gapRes || []);

        const intakeRes = await getIntake(companyId);
        setIntakeCache(intakeRes.data || intakeRes || {});

        const docsRes = await getDocuments(companyId);
        setDocsCache(docsRes.data || docsRes || []);

        try {
          const auditRes = await getAuditLogs(companyId, 1, 50);
          const payload = auditRes.data || auditRes || {};
          setAuditLogs(payload.logs || payload.data || (Array.isArray(payload) ? payload : []));
        } catch (auditErr) {
          setAuditLogs([]);
        }
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
    window.addEventListener('storage', handleStorageChange);

    const pollInterval = setInterval(() => {
      loadDraftData(true);
    }, 2500);

    return () => {
      if (syncChannelRef.current) syncChannelRef.current.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
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
