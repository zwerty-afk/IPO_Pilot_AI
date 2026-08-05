import React, { useState } from 'react';
import { 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { SECTION_UPLOADS } from '../data/intakeSchema';

export const SECTION_KEYS = {
  business_overview: "Business Overview",
  risk_factors: "Risk Factors",
  objects: "Objects of the Issue",
  capital_structure: "Capital Structure",
  financials: "Financial Information",
  related_party: "Related Party Transactions",
  litigation: "Litigation & Legal Proceedings",
  promoter_details: "Promoter & Management Details",
  legal_compliance: "Legal & Compliance",
  risk_information: "Risk Information",
  other_disclosures: "Other Disclosures"
};

export function getIntakeForSection(key, intakeData = {}) {
  if (!intakeData) return {};
  const aliasMap = {
    risk_factors: 'risk_information',
    related_party: 'rpt',
    promoter_details: 'promoters'
  };
  const targetKey = aliasMap[key] || key;
  if (intakeData[targetKey] && typeof intakeData[targetKey] === 'object' && Object.keys(intakeData[targetKey]).length > 0) {
    return intakeData[targetKey];
  }
  if (intakeData[key] && typeof intakeData[key] === 'object' && Object.keys(intakeData[key]).length > 0) {
    return intakeData[key];
  }
  return intakeData || {};
}

// Computes dynamic health metrics for a given chapter
export function computeChapterHealth(key, drafts = {}, intakeData = {}, documents = []) {
  const sectionDraft = drafts[key] || {};
  const sectionIntake = getIntakeForSection(key, intakeData);
  const requiredUploads = SECTION_UPLOADS[key] || [];

  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));
  const missingDocs = requiredUploads.filter(s => !uploadedDocTypes.has(s.docType));
  const uploadedCount = requiredUploads.length - missingDocs.length;

  const values = Object.values(sectionIntake).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  const isStarted = values.length > 0 || uploadedCount > 0 || (sectionDraft.blocks && sectionDraft.blocks.length > 0);

  if (!isStarted) {
    return {
      statusKey: 'not_started',
      statusLabel: 'Not Started',
      dotColor: 'bg-slate-300',
      badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
      score: 0,
      confidenceScore: 0,
      evidenceScore: 0,
      completionScore: 0,
      criticalCount: 0,
      warningCount: 0,
      missingDocs: requiredUploads.map(s => s.label)
    };
  }

  if (sectionDraft.status === 'processing') {
    return {
      statusKey: 'processing',
      statusLabel: 'AI Processing',
      dotColor: 'bg-blue-500 animate-pulse',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      score: 50,
      confidenceScore: 60,
      evidenceScore: 50,
      completionScore: 50,
      criticalCount: 0,
      warningCount: 0,
      missingDocs: missingDocs.map(s => s.label)
    };
  }

  let baseScore = 85;
  let criticalCount = 0;
  let warningCount = 0;

  if (missingDocs.length > 0) {
    baseScore -= missingDocs.length * 15;
    warningCount += missingDocs.length;
  }

  if (sectionDraft.status === 'clarification_requested') {
    baseScore -= 20;
    criticalCount += 1;
  }

  const lowConfBlocks = (sectionDraft.blocks || []).filter(b => b.confidence === 'low');
  if (lowConfBlocks.length > 0) {
    baseScore -= lowConfBlocks.length * 10;
    warningCount += lowConfBlocks.length;
  }

  const score = Math.max(15, Math.min(98, baseScore));
  const completionScore = Math.min(100, Math.round(((values.length + uploadedCount * 3) / 8) * 100));
  const evidenceScore = requiredUploads.length === 0 ? 95 : Math.round((uploadedCount / requiredUploads.length) * 100);
  const confidenceScore = score >= 80 ? 92 : score >= 60 ? 75 : 55;

  let statusKey = 'healthy';
  let statusLabel = 'Healthy';
  let dotColor = 'bg-emerald-500';
  let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (score < 45 || criticalCount > 0) {
    statusKey = 'critical';
    statusLabel = 'Critical';
    dotColor = 'bg-red-500';
    badgeBg = 'bg-red-50 text-red-700 border-red-200';
  } else if (missingDocs.length > 0 || score < 65) {
    statusKey = 'high_attention';
    statusLabel = 'Attention Required';
    dotColor = 'bg-amber-500';
    badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (score < 80 || warningCount > 0) {
    statusKey = 'needs_review';
    statusLabel = 'Needs Review';
    dotColor = 'bg-yellow-500';
    badgeBg = 'bg-yellow-50 text-yellow-800 border-yellow-200';
  }

  return {
    statusKey,
    statusLabel,
    dotColor,
    badgeBg,
    score,
    confidenceScore,
    evidenceScore,
    completionScore,
    criticalCount,
    warningCount,
    missingDocs: missingDocs.map(s => s.label)
  };
}

export default function ChapterHealthSidebar({
  selectedSectionKey,
  setSelectedSectionKey,
  drafts = {},
  intakeData = {},
  documents = []
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 relative">
      <div className="flex items-center justify-between px-2 mb-2 pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Chapters & Health</span>
        </h3>
        <span className="text-[10px] text-slate-400 font-mono">11 Chapters</span>
      </div>

      <div className="space-y-1">
        {Object.entries(SECTION_KEYS).map(([key, label]) => {
          const isActive = key === selectedSectionKey;
          const health = computeChapterHealth(key, drafts, intakeData, documents);
          const isHovered = hoveredKey === key;

          return (
            <div 
              key={key} 
              className="relative group"
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <button
                type="button"
                onClick={() => setSelectedSectionKey(key)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/20' 
                    : 'text-slate-700 font-medium hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="truncate pr-2">{label}</span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${health.dotColor}`} />
              </button>

              {/* Clean Popover Summary Card */}
              {isHovered && (
                <div className="absolute left-full top-0 ml-3 z-50 w-64 p-3.5 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 animate-fade-in pointer-events-none space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900 truncate pr-2">{label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${health.badgeBg}`}>
                      {health.statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-mono uppercase font-bold">AI Health Score</p>
                      <p className="text-sm font-extrabold text-slate-900">{health.score} / 100</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-mono uppercase font-bold">Evidence Score</p>
                      <p className="text-sm font-extrabold text-slate-900">{health.evidenceScore}%</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] font-medium text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Critical Issues:</span>
                      <span className={health.criticalCount > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                        {health.criticalCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Missing Documents:</span>
                      <span className={health.missingDocs.length > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                        {health.missingDocs.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 space-y-1.5">
        <p className="font-bold uppercase text-slate-500 tracking-wider font-mono">Status Indicators</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600 font-medium">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Needs Review</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Attention</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</div>
        </div>
      </div>
    </div>
  );
}
