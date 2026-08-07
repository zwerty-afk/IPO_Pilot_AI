import React from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
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

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word, idx) => {
      if (idx > 0 && ['and', 'or', 'the', 'of', 'in', 'for', 'on', 'with', 'a', 'an'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export default function ChapterHealthSidebar({
  activeId,
  setActiveId,
  onNavigateSection,
  drafts = {},
  gapReport = [],
  variant = 'light' // 'light' | 'dark'
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
    setExpandedSectionId(sec.id);
    const targetId = (sec.subsections && sec.subsections.length > 0)
      ? sec.subsections[0].id
      : sec.id;

    if (setActiveId) setActiveId(targetId);
    if (onNavigateSection) {
      onNavigateSection(backendKey || sec.key, targetId);
    }
  };

  const handleSubClick = (subId, backendKey, e) => {
    e.stopPropagation();
    if (setActiveId) setActiveId(subId);
    if (onNavigateSection) {
      onNavigateSection(backendKey, subId);
    }
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

  const isDark = variant === 'dark';

  return (
    <div className={isDark ? "space-y-1 font-sans" : "bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-2 sticky top-6 max-h-[90vh] overflow-y-auto font-sans"}>
      {!isDark && (
        <h3 className="font-bold text-slate-800 text-sm px-3 mb-4">DRHP Table of Contents</h3>
      )}

      <div className="space-y-1">
        {DRHP_HIERARCHY.map((sec, secIdx) => {
          const secNum = secIdx + 1;
          const isExpanded = expandedSectionId === sec.id;
          const isSecActive = activeId === sec.id;
          const hasSub = sec.subsections && sec.subsections.length > 0;
          const secDraft = drafts[sec.key];
          const isCertified = secDraft && secDraft.status === 'certified';
          const secGap = hasUnresolvedGap(sec.key);
          const titleText = toTitleCase(sec.title);

          return (
            <div key={sec.id} className="space-y-1">
              {/* Parent Section Item */}
              <button
                type="button"
                onClick={() => handleParentClick(sec, sec.key)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isSecActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : isDark
                    ? 'text-slate-300 hover:text-white hover:bg-white/5'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className="truncate flex-1">{titleText}</span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isCertified ? (
                    <Check className={`w-3.5 h-3.5 shrink-0 ${isSecActive ? 'text-white' : 'text-emerald-400'}`} title="Section certified" />
                  ) : secGap ? (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isSecActive ? 'bg-white/70' : 'bg-amber-400'}`} title="Contains unresolved gap" />
                  ) : null}

                  {hasSub && (
                    <span className={isSecActive ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-400'}>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </button>

              {/* Subsections Accordion List */}
              {hasSub && isExpanded && (
                <div className={`ml-3 pl-2 border-l space-y-1 my-1 ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
                  {sec.subsections.map((sub, subIdx) => {
                    const subNum = `${secNum}.${subIdx + 1}`;
                    const isSubActive = activeId === sub.id;
                    const subGap = hasUnresolvedGap(sub.key);
                    const subDraft = drafts[sub.key];
                    const isSubCertified = subDraft && subDraft.status === 'certified';
                    const cleanSubTitle = (sub.title || '').replace(/^\d+(\.\d+)*\s*/, '').trim();
                    const subTitleText = `${subNum} ${toTitleCase(cleanSubTitle)}`;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={(e) => handleSubClick(sub.id, sub.key, e)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-all duration-200 cursor-pointer ${
                          isSubActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-semibold'
                            : isDark
                            ? 'text-slate-400 hover:text-white hover:bg-white/5'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <span className="truncate flex-1">{subTitleText}</span>
                        {isSubCertified ? (
                          <Check className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-emerald-400'}`} title="Subsection certified" />
                        ) : subGap ? (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isSubActive ? 'bg-white/70' : 'bg-amber-400'}`} title="Contains unresolved gap" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

