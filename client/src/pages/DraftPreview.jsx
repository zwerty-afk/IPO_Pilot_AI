import React from 'react';
import { useDraftDocument } from '../context/DraftDocumentContext';
import ChapterHealthSidebar from '../components/ChapterHealthSidebar';
import DraftCanvas from '../components/DraftCanvas';

export default function DraftPreview({ initialMode = 'chapter' }) {
  const {
    activeTocId,
    setActiveTocId,
    selectedSectionKey,
    drafts,
    gapReport,
    comments,
    auditLogs,
    editorText,
    setEditorText,
    saveContent,
    postComment,
    resolveCommentById,
    user
  } = useDraftDocument();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in relative font-sans">
      {initialMode === 'chapter' && (
        <div className="xl:col-span-1">
          <ChapterHealthSidebar
            activeId={activeTocId}
            setActiveId={setActiveTocId}
            onNavigateSection={(backendKey, subId) => {
              setActiveTocId(subId);
              const elem = document.getElementById(`drhp-sub-${subId}`) || document.getElementById(subId);
              if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            drafts={drafts}
            gapReport={gapReport}
            comments={comments}
            auditLogs={auditLogs}
            aiSuggestions={[]}
            openIssues={[]}
            versions={[]}
            onCommentClick={(comm) => {
              const targetId = comm.block_id || activeTocId;
              const elem = document.getElementById(`drhp-sub-${targetId}`) || document.getElementById(targetId);
              if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onIssueClick={() => {}}
            onAcceptSuggestion={() => {}}
            onDismissSuggestion={() => {}}
            onConvertSuggestionToComment={() => {}}
            onVersionClick={() => {}}
            onAddComment={(text) => postComment(text, 'note')}
            onResolveComment={(commId) => resolveCommentById(commId)}
          />
        </div>
      )}

      <div className={initialMode === 'chapter' ? 'xl:col-span-2' : 'xl:col-span-3'}>
        <DraftCanvas showToolbar={true} mode={initialMode} />
      </div>
    </div>
  );
}