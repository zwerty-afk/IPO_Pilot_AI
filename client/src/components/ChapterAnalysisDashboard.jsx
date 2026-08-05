import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles,
  ArrowUpRight,
  Bookmark,
  FileText,
  ShieldCheck,
  Search,
  Check,
  XCircle,
  UserCheck,
  Clock
} from 'lucide-react';
import { computeChapterHealth, getIntakeForSection, SECTION_KEYS } from './ChapterHealthSidebar';
import { stepQuestions, requiredQuestions, SECTION_UPLOADS, checkFieldAgainstDocuments, formatInr } from '../data/intakeSchema';
import ConfidenceBadge from './ConfidenceBadge';
import StatusBadge from './StatusBadge';

export default function ChapterAnalysisDashboard({ 
  selectedSectionKey, 
  drafts = {}, 
  intakeData = {}, 
  documents = [], 
  onNavigateToIntake,
  onCitationClick
}) {
  const [activeTab, setActiveTab] = useState('text'); // 'text' (Tab A) or 'evidence' (Tab B)

  const health = computeChapterHealth(selectedSectionKey, drafts, intakeData, documents);
  const currentSection = drafts[selectedSectionKey] || { status: 'draft', blocks: [] };
  const draftBlocks = currentSection.blocks || [];

  // Map chapter key to intake schema step key
  const intakeKey = selectedSectionKey === 'risk_factors' ? 'risk_information' : 
                    selectedSectionKey === 'related_party' ? 'rpt' : 
                    selectedSectionKey === 'promoter_details' ? 'promoters' : selectedSectionKey;

  const sectionIntake = getIntakeForSection(selectedSectionKey, intakeData);
  const questions = stepQuestions[intakeKey] || [];
  const requiredUploads = SECTION_UPLOADS[selectedSectionKey] || [];
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));

  // --- TAB B: GAP & EVIDENCE REPORT LISTS ---
  // 1. COMPLETE ITEMS
  const completeItems = [];
  questions.forEach(q => {
    const val = sectionIntake[q.name];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      completeItems.push({
        id: `field-${q.name}`,
        label: q.label,
        value: typeof val === 'object' ? JSON.stringify(val) : String(val),
        citation: `Intake: ${SECTION_KEYS[selectedSectionKey] || selectedSectionKey}: ${q.name}`,
        type: 'field'
      });
    }
  });

  requiredUploads.forEach(slot => {
    const doc = documents.find(d => d.doc_type === slot.docType);
    if (doc) {
      completeItems.push({
        id: `doc-${slot.key}`,
        label: slot.label,
        value: doc.name || 'Uploaded & Verified',
        citation: `Document: ${doc.name}`,
        type: 'document'
      });
    }
  });

  // 2. MISSING ITEMS
  const missingItems = [];
  const reqQs = requiredQuestions(intakeKey, sectionIntake);
  reqQs.forEach(q => {
    const val = sectionIntake[q.name];
    if (val === undefined || val === null || String(val).trim() !== '') {
      missingItems.push({
        id: `missing-field-${q.name}`,
        label: q.label,
        reason: 'Required Intake Field Empty',
        type: 'field',
        fieldName: q.name,
        stepKey: intakeKey
      });
    }
  });

  requiredUploads.forEach(slot => {
    const isUploaded = uploadedDocTypes.has(slot.docType);
    if (!isUploaded) {
      missingItems.push({
        id: `missing-doc-${slot.key}`,
        label: slot.label,
        reason: 'Required Source Document Missing',
        type: 'document',
        docType: slot.docType
      });
    }
  });

  // 3. INCONSISTENCY ITEMS
  const inconsistencyItems = [];
  questions.forEach(q => {
    const val = sectionIntake[q.name];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const issue = checkFieldAgainstDocuments(intakeKey, q.name, val, documents);
      if (issue) {
        inconsistencyItems.push({
          id: `mismatch-${q.name}`,
          label: q.label,
          message: `Intake states "${issue.enteredDisplay}", but document (${issue.docName}) records "${issue.docDisplay}".`,
          intakeValue: issue.enteredDisplay,
          docValue: issue.docDisplay,
          docName: issue.docName,
          severity: 'high'
        });
      }
    }
  });

  // Chapter specific inconsistency/risk flags for Risk Information
  if (selectedSectionKey === 'risk_information' || selectedSectionKey === 'risk_factors') {
    const riskInfo = intakeData.risk_information || {};
    if (riskInfo.top5_customers_pct && Number(riskInfo.top5_customers_pct) > 40) {
      inconsistencyItems.push({
        id: 'flag-customer-concentration',
        label: 'Top 5 Customer Concentration',
        message: `High concentration risk: Top 5 customers account for ${riskInfo.top5_customers_pct}% of total revenue (>40% threshold).`,
        intakeValue: `${riskInfo.top5_customers_pct}%`,
        docValue: 'N/A',
        severity: 'medium'
      });
    }
    if (riskInfo.single_factory === 'yes') {
      inconsistencyItems.push({
        id: 'flag-single-factory',
        label: 'Single Facility Concentration',
        message: 'Operational risk: Company operates out of a single plant location.',
        intakeValue: 'Single Plant',
        docValue: 'N/A',
        severity: 'medium'
      });
    }
    if (riskInfo.pending_tax_demand && Number(riskInfo.pending_tax_demand) > 0) {
      inconsistencyItems.push({
        id: 'flag-tax-demand',
        label: 'Pending Tax Demand',
        message: `Financial risk: Pending tax demand of ${formatInr(riskInfo.pending_tax_demand)} under appeal.`,
        intakeValue: formatInr(riskInfo.pending_tax_demand),
        docValue: 'N/A',
        severity: 'high'
      });
    }
  }

  const hasAnyReportItems = completeItems.length > 0 || missingItems.length > 0 || inconsistencyItems.length > 0;

  // Clean SVG Circular Gauge matching Intake Form aesthetic
  const renderHealthGauge = (score) => {
    const strokeDashoffset = 283 - (283 * score) / 100;
    const gaugeColor = score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : '#ef4444';
    return (
      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" className="stroke-slate-100 fill-none stroke-[8]" />
          <circle 
            cx="50" 
            cy="50" 
            r="45" 
            className="fill-none stroke-[8] transition-all duration-700 ease-out"
            stroke={gaugeColor}
            strokeDasharray="283"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-center">
          <span className="text-base font-extrabold text-slate-900 block leading-none">{score}%</span>
        </div>
      </div>
    );
  };

  // Risk Information metrics (Customer Concentration % & Supplier Dependency %) ONLY for Risk Information chapter
  const isRiskChapter = selectedSectionKey === 'risk_information' || selectedSectionKey === 'risk_factors';
  const riskInfoData = intakeData.risk_information || {};
  const hasTop5 = isRiskChapter && riskInfoData.top5_customers_pct !== undefined && riskInfoData.top5_customers_pct !== null && String(riskInfoData.top5_customers_pct).trim() !== '';
  const hasTopSupplier = isRiskChapter && riskInfoData.top_supplier_pct !== undefined && riskInfoData.top_supplier_pct !== null && String(riskInfoData.top_supplier_pct).trim() !== '';
  const top5Pct = hasTop5 ? Number(riskInfoData.top5_customers_pct) : null;
  const topSupplierPct = hasTopSupplier ? Number(riskInfoData.top_supplier_pct) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Top Completeness & Overview Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {renderHealthGauge(health.completionScore)}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {SECTION_KEYS[selectedSectionKey] || selectedSectionKey}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${health.badgeBg}`}>
                  {health.statusLabel}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Chapter Completeness: <span className="font-bold text-slate-700">{health.completionScore}%</span> • Source intake fields & document evidence status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onNavigateToIntake}
              className="text-xs font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
            >
              <span>Edit Source Intake</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RISK INFORMATION CHAPTER METRICS ONLY */}
        {isRiskChapter && (hasTop5 || hasTopSupplier) && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
            {hasTop5 && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-slate-700">Top 5 Customer Concentration</span>
                  <span className="font-bold text-indigo-700">{top5Pct}% Revenue Share</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full" style={{ width: `${Math.min(100, top5Pct)}%` }} />
                </div>
              </div>
            )}
            {hasTopSupplier && (
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-slate-700">Top Supplier Dependency</span>
                  <span className="font-bold text-amber-700">{topSupplierPct}% Procurement</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, topSupplierPct)}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Main Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'text'
              ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Tab A — Synthesized Draft Text</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {draftBlocks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'evidence'
              ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Tab B — Gap & Evidence Report</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/50">
            {completeItems.length} Complete
          </span>
        </button>
      </div>

      {/* SUB-TAB A: SYNTHESIZED DRAFT TEXT */}
      {activeTab === 'text' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm min-h-[380px] space-y-4 animate-fade-in">
          {draftBlocks.length > 0 ? (
            <div className="space-y-4">
              {draftBlocks.map((block) => {
                const isLow = block.confidence === 'low';
                const isMed = block.confidence === 'medium';
                return (
                  <div 
                    key={block.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      isLow ? 'bg-red-50/30 border-l-4 border-l-red-500 border-red-200' : 
                      isMed ? 'bg-amber-50/30 border-l-4 border-l-amber-500 border-amber-200' : 
                      'bg-slate-50/50 border-l-4 border-l-indigo-500 border-slate-200/80'
                    }`}
                  >
                    <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line font-sans">{block.text}</p>
                    
                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-black/5 text-[11px] gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider">Citations:</span>
                        {block.citations && block.citations.map((cite, cidx) => (
                          <button
                            key={cidx}
                            type="button"
                            onClick={() => onCitationClick && onCitationClick(cite)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors border border-indigo-200/40 text-[11px]"
                          >
                            <Bookmark className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="max-w-[180px] truncate">{cite.split(': ').pop()}</span>
                          </button>
                        ))}
                      </div>
                      <ConfidenceBadge level={block.confidence} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500">
                No draft text generated yet — complete the relevant Intake Form sections to generate DRHP draft text.
              </p>
              <button
                type="button"
                onClick={onNavigateToIntake}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
              >
                <span>Complete Intake Form</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB B: GAP & EVIDENCE REPORT */}
      {activeTab === 'evidence' && (
        <div className="space-y-4 animate-fade-in">
          {!hasAnyReportItems ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                No data yet for this chapter — complete the relevant Intake Form sections to see this analysis.
              </p>
              <button
                type="button"
                onClick={onNavigateToIntake}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
              >
                <span>Complete Intake Form</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* 1. COMPLETE LIST */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>1. Complete ({completeItems.length} Filled Fields & Documents)</span>
                </h4>
                {completeItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {completeItems.map(item => (
                      <div key={item.id} className="p-3 bg-emerald-50/40 border border-emerald-200/60 rounded-xl flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block text-[11px]">{item.label}</span>
                          <p className="text-slate-600 text-[11px] line-clamp-2">{item.value}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCitationClick && onCitationClick(item.citation)}
                          className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold border border-emerald-200 hover:bg-emerald-200 transition-colors"
                        >
                          <Bookmark className="w-3 h-3 text-emerald-600" />
                          <span>Source</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No completed fields or documents yet.</p>
                )}
              </div>

              {/* 2. MISSING LIST */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>2. Missing ({missingItems.length} Empty Required Fields & Documents)</span>
                </h4>
                {missingItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {missingItems.map(item => (
                      <div key={item.id} className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-amber-900 block text-[11px]">{item.label}</span>
                          <span className="text-[10px] text-amber-700 font-mono">{item.reason}</span>
                        </div>
                        <button
                          type="button"
                          onClick={onNavigateToIntake}
                          className="shrink-0 text-[10px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-0.5"
                        >
                          <span>Complete</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All required fields and documents for this chapter are complete.
                  </p>
                )}
              </div>

              {/* 3. INCONSISTENCIES LIST */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>3. Inconsistencies & Validation Flags ({inconsistencyItems.length})</span>
                </h4>
                {inconsistencyItems.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {inconsistencyItems.map(item => (
                      <div key={item.id} className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-900 text-[11px]">{item.label}</span>
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                            {item.severity} severity
                          </span>
                        </div>
                        <p className="text-red-950 text-[11px] font-medium leading-relaxed">{item.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zero cross-document or consistency mismatches detected for this chapter.
                  </p>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Reviewer Status Bar (Bottom of tab) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-700">Reviewer Status:</span>
          <StatusBadge status={currentSection.status} />
        </div>

        {currentSection.status === 'certified' ? (
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Certified by <span className="font-bold">{currentSection.certified_by || 'Registered Merchant Banker'}</span>
              {currentSection.certified_at && ` on ${new Date(currentSection.certified_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px] italic">
            Pending Merchant Banker certification in Reviewer Workspace
          </span>
        )}
      </div>

    </div>
  );
}
