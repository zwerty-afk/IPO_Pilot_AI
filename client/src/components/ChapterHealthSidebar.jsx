import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { DRHP_HIERARCHY } from '../data/sebiDrhpSchema';

export const SECTION_KEYS = {
  company_details: "Chapter 1: Company Profile",
  business_overview: "Chapter 2: Business Overview",
  financials: "Chapter 3: Financial Information",
  capital_structure: "Chapter 4: Capital Structure",
  objects: "Chapter 5: Objects of the Issue",
  promoter_details: "Chapter 6: Promoters & Management",
  related_party: "Chapter 7: Related Party Transactions",
  risk_factors: "Chapter 8: Risk Factors",
  litigation: "Chapter 9: Litigation & Legal Proceedings",
  legal_compliance: "Chapter 10: Legal & Compliance",
  other_disclosures: "Chapter 11: Other Disclosures"
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

export function computeChapterHealth(key, drafts = {}, intakeData = {}, documents = []) {
  const sectionDraft = drafts[key] || {};
  const sectionIntake = getIntakeForSection(key, intakeData);
  const values = Object.values(sectionIntake).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  const isStarted = values.length > 0 || (documents || []).length > 0 || (sectionDraft.blocks && sectionDraft.blocks.length > 0);
  if (!isStarted) {
    return { statusKey: 'not_started', statusLabel: 'Not Started', score: 0, confidenceScore: 0, evidenceScore: 0, criticalCount: 0, warningCount: 0, missingDocs: [] };
  }
  return { statusKey: 'healthy', statusLabel: 'Healthy', score: 85, confidenceScore: 90, evidenceScore: 80, criticalCount: 0, warningCount: 0, missingDocs: [] };
}

export default function ChapterHealthSidebar({
  activeId,
  setActiveId,
  onNavigateSection,
  drafts = {},
  gapReport = []
}) {
  // Find which parent section contains activeId
  const getParentSectionId = (targetId) => {
    if (!targetId) return 'general';
    for (const sec of DRHP_HIERARCHY) {
      if (sec.id === targetId) return sec.id;
      if (sec.subsections && sec.subsections.some(sub => sub.id === targetId)) {
        return sec.id;
      }
    }
    return 'general';
  };

  const [expandedSectionId, setExpandedSectionId] = React.useState(() => getParentSectionId(activeId));

  React.useEffect(() => {
    if (activeId) {
      const parentId = getParentSectionId(activeId);
      setExpandedSectionId(parentId);
    }
  }, [activeId]);

  const handleParentClick = (sec, backendKey) => {
    setExpandedSectionId(prev => (prev === sec.id ? null : sec.id));
    if (setActiveId) setActiveId(sec.id);
    if (onNavigateSection && backendKey) {
      onNavigateSection(backendKey, sec.id);
    }
    setTimeout(() => {
      const elem = document.getElementById(sec.id);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleSubClick = (subId, backendKey, e) => {
    e.stopPropagation();
    if (setActiveId) setActiveId(subId);
    if (onNavigateSection && backendKey) {
      onNavigateSection(backendKey, subId);
    }
    setTimeout(() => {
      const elem = document.getElementById(subId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const hasUnresolvedGap = (key) => {
    if (!Array.isArray(gapReport) || gapReport.length === 0 || !key) return false;
    const keyMap = { risk_factors: 'risk_information', related_party: 'rpt', promoter_details: 'promoters' };
    const targetKey = keyMap[key] || key;
    return gapReport.some(g => {
      const field = g.fieldName || '';
      return field.startsWith(key) || field.startsWith(targetKey);
    });
  };

  return (
    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2 sticky top-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-1.5 pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          <span>DRHP Table of Contents</span>
        </h3>
        <span className="text-[9px] bg-indigo-50 font-mono text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
          Legal Outline
        </span>
      </div>

      <div className="space-y-0.5 text-xs font-sans">
        {DRHP_HIERARCHY.map((sec, secIdx) => {
          const secNum = secIdx + 1;
          const isExpanded = expandedSectionId === sec.id;
          const isSecActive = activeId === sec.id;
          const hasSub = sec.subsections && sec.subsections.length > 0;
          const secGap = hasUnresolvedGap(sec.key);

          return (
            <div key={sec.id} className="space-y-0.5">
              {/* Parent Section Row */}
              <div
                onClick={() => handleParentClick(sec, sec.key)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-bold cursor-pointer transition-all duration-150 ${
                  isSecActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-800 hover:bg-slate-100/80 hover:text-indigo-600'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate pr-2">
                  <span className={`font-mono text-xs shrink-0 ${isSecActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {secNum}.
                  </span>
                  <span className="truncate text-xs tracking-tight uppercase">{sec.title}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {secGap && (
                    <AlertCircle
                      className={`w-3.5 h-3.5 shrink-0 ${isSecActive ? 'text-amber-300' : 'text-amber-500'}`}
                      title="Contains unresolved issues from Gap Analysis"
                    />
                  )}
                  {hasSub && (
                    <span className={`p-0.5 ${isSecActive ? 'text-white' : 'text-slate-400'}`}>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </div>

              {/* Subsections Accordion Drawer */}
              {hasSub && isExpanded && (
                <div className="ml-3 pl-2 border-l border-slate-200 space-y-0.5 py-0.5">
                  {sec.subsections.map((sub, subIdx) => {
                    const subNum = `${secNum}.${subIdx + 1}`;
                    const isSubActive = activeId === sub.id;
                    const subGap = hasUnresolvedGap(sub.key);

                    return (
                      <div
                        key={sub.id}
                        onClick={(e) => handleSubClick(sub.id, sub.key, e)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left text-[11px] font-medium cursor-pointer transition-all ${
                          isSubActive
                            ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-1.5 truncate pr-1">
                          <span className={`font-mono text-[10px] shrink-0 ${isSubActive ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {subNum}
                          </span>
                          <span className="truncate leading-tight">{sub.title}</span>
                        </div>
                        {subGap && (
                          <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono text-center">
        Fixed SEBI DRHP Master Outline
      </div>
    </div>
  );
}
