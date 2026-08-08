/**
 * Single Source of Truth IPO Readiness Scoring Engine
 *
 * Fixed 100-Point, 4-Stage Cumulative Model — mirrors the real IPO prep journey:
 *
 *   1. INTAKE FORM & COMPANY INFORMATION   = 40 Points  (11 sections, weighted by importance)
 *   2. COMPLIANCE CHECKS                   = 20 Points  (12 SEBI/Companies Act rules)
 *   3. GAP ANALYSIS & REMEDIATION          = 20 Points  (6 AI-detected consistency/risk checks)
 *   4. REVIEWER CERTIFICATION              = 20 Points  (11 DRHP chapters, reviewer-only)
 *   ─────────────────────────────────────────────────────────────────────────
 *   TOTAL                                  = 100 Points
 *
 * Rules:
 *  - Purely additive/monotonic. Nothing in this file ever subtracts points —
 *    identifying a risk, a gap, or a failed check never reduces the score; it
 *    simply means those points haven't been earned yet.
 *  - Every point traces to a real, already-persisted action (an intake field
 *    filled, a document uploaded, a gap resolved, a chapter certified). Nothing
 *    is awarded for merely opening a page.
 *  - Strictly scoped to the company whose intake/documents/gapReport/drafts are
 *    passed in — the caller (DraftDocumentContext) already fetches all four
 *    keyed to the active companyId, so a new company naturally starts at 0/100
 *    and switching companies never leaks progress between them.
 */

import { INTAKE_SECTION_POINTS, getSectionCompletionRatio, steps as INTAKE_STEPS } from '../data/intakeSchema';
import { COMPLIANCE_MAX, computeComplianceChecklist } from './complianceRules';
import { GAP_ANALYSIS_MAX, computeGapAnalysisChecks } from './gapAnalysisChecks';

export const READINESS_WEIGHTS = {
  INTAKE_MAX: 40,
  COMPLIANCE_MAX,
  GAP_ANALYSIS_MAX,
  CERTIFICATION_MAX: 20,
  TOTAL_MAX: 100
};

// Reviewer Certification — 20 points across the 11 real DRHP chapters that the
// Reviewer Workspace actually certifies (drafts[key].status === 'certified').
// Only an actual certification counts; "approved" alone earns nothing here —
// certification is reviewer-only and is the final sign-off, not a midpoint.
export const CERTIFICATION_CHAPTER_POINTS = {
  company_details: 2,
  business_overview: 2,
  financials: 2,
  capital_structure: 2,
  objects: 2,
  promoter_details: 2,
  risk_factors: 2,
  litigation: 2,
  legal_compliance: 2,
  related_party: 1,
  other_disclosures: 1
};

const CHAPTER_LABELS = {
  company_details: 'General Information & Company Profile',
  business_overview: 'Business Overview',
  financials: 'Financial Information',
  capital_structure: 'Capital Structure',
  objects: 'Objects of the Issue',
  promoter_details: 'Promoters & Management',
  related_party: 'Related Party Transactions',
  risk_factors: 'Risk Factors',
  litigation: 'Litigation & Legal Proceedings',
  legal_compliance: 'Legal & Compliance',
  other_disclosures: 'Other Disclosures'
};

const STEP_LABELS = INTAKE_STEPS.reduce((acc, s) => { acc[s.key] = s.label; return acc; }, {});

function statusForScore(score) {
  if (score >= 100) return { label: 'IPO Ready', tier: 'ready' };
  if (score >= 80) return { label: 'Nearly IPO ready', tier: 'nearly-ready' };
  if (score >= 60) return { label: 'Strong progress', tier: 'strong' };
  if (score >= 40) return { label: 'Good progress', tier: 'good' };
  if (score >= 20) return { label: 'Preparation in progress', tier: 'in-progress' };
  return { label: 'Getting started', tier: 'starting' };
}

export function calculateSingleSourceOfTruthReadiness(intakeData = {}, documents = [], gapReport = [], drafts = {}) {
  // ── 1. INTAKE FORM & COMPANY INFORMATION (40 POINTS) ────────────────────────
  const intakeSections = Object.entries(INTAKE_SECTION_POINTS).map(([key, max]) => {
    const { filled, total, ratio } = getSectionCompletionRatio(key, intakeData, documents);
    const points = Math.round(ratio * max);
    return { key, label: STEP_LABELS[key] || key, points, max, filled, total, route: `/intake?step=${key}` };
  });
  const intakeScore = Math.min(40, intakeSections.reduce((sum, s) => sum + s.points, 0));

  // ── 2. COMPLIANCE CHECKS (20 POINTS) ─────────────────────────────────────────
  const complianceRules = computeComplianceChecklist(intakeData, documents);
  const complianceScore = Math.min(COMPLIANCE_MAX, complianceRules.reduce((sum, r) => sum + (r.earnedPoints || 0), 0));

  // ── 3. GAP ANALYSIS & REMEDIATION (20 POINTS) ────────────────────────────────
  const gapChecks = computeGapAnalysisChecks(intakeData, documents, gapReport);
  const gapScore = Math.min(GAP_ANALYSIS_MAX, gapChecks.reduce((sum, c) => sum + (c.earnedPoints || 0), 0));

  // ── 4. REVIEWER CERTIFICATION (20 POINTS) ────────────────────────────────────
  const certificationChapters = Object.entries(CERTIFICATION_CHAPTER_POINTS).map(([key, max]) => {
    const status = (drafts[key] && drafts[key].status) || 'draft';
    const certified = status === 'certified';
    return { key, label: CHAPTER_LABELS[key] || key, points: certified ? max : 0, max, status, route: '/reviewer' };
  });
  const certificationScore = Math.min(20, certificationChapters.reduce((sum, c) => sum + c.points, 0));

  // ── TOTAL (0-100) ─────────────────────────────────────────────────────────────
  const totalScore = Math.min(100, Math.max(0, intakeScore + complianceScore + gapScore + certificationScore));

  const stages = {
    intake: {
      key: 'intake', title: 'Intake & Company Information', score: intakeScore, max: 40,
      pct: Math.round((intakeScore / 40) * 100), sections: intakeSections
    },
    compliance: {
      key: 'compliance', title: 'Compliance & SEBI Checks', score: complianceScore, max: COMPLIANCE_MAX,
      pct: Math.round((complianceScore / COMPLIANCE_MAX) * 100), rules: complianceRules
    },
    gapAnalysis: {
      key: 'gapAnalysis', title: 'Gap Analysis & Remediation', score: gapScore, max: GAP_ANALYSIS_MAX,
      pct: Math.round((gapScore / GAP_ANALYSIS_MAX) * 100), checks: gapChecks
    },
    certification: {
      key: 'certification', title: 'Reviewer Certification', score: certificationScore, max: 20,
      pct: Math.round((certificationScore / 20) * 100), chapters: certificationChapters
    }
  };

  // ── "How to earn the remaining points" ───────────────────────────────────────
  const nextActions = [];
  if (stages.intake.max - stages.intake.score > 0) {
    nextActions.push({
      stage: 'intake', label: 'Intake', pointsRemaining: stages.intake.max - stages.intake.score,
      description: 'Complete remaining Intake sections', route: '/intake'
    });
  }
  if (stages.compliance.max - stages.compliance.score > 0) {
    nextActions.push({
      stage: 'compliance', label: 'Compliance', pointsRemaining: stages.compliance.max - stages.compliance.score,
      description: 'Resolve remaining compliance checks', route: '/compliance-checklist'
    });
  }
  if (stages.gapAnalysis.max - stages.gapAnalysis.score > 0) {
    nextActions.push({
      stage: 'gapAnalysis', label: 'Gap Analysis', pointsRemaining: stages.gapAnalysis.max - stages.gapAnalysis.score,
      description: 'Complete outstanding remediation actions', route: '/gap-analysis'
    });
  }
  if (stages.certification.max - stages.certification.score > 0) {
    nextActions.push({
      stage: 'certification', label: 'Certification', pointsRemaining: stages.certification.max - stages.certification.score,
      description: 'Complete reviewer certification', route: '/reviewer'
    });
  }

  return {
    score: totalScore,
    displayScore: `${totalScore} / 100`,
    percentage: `${totalScore}%`,
    status: statusForScore(totalScore),
    remainingPoints: 100 - totalScore,
    stages,
    nextActions
  };
}
