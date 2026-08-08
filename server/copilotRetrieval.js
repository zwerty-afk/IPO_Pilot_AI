// IPO Copilot retrieval layer.
//
//   userQuestion -> detectSources() -> retrieveSources() -> buildContextBlock() -> LLM
//
// The point of this module is that the assistant never receives the whole
// application state. It receives only the slices the question actually needs,
// each labeled with the real in-app route it came from so the model can cite a
// clickable source. Every loader reads live data passed in by the caller (which
// reads it from db.js) — nothing here stores or caches an answer, and nothing
// here invents a value: a field that isn't in the workspace comes back absent,
// and the prompt tells the model to say so rather than fill it in.

import { DRHP_HIERARCHY, getExportBlocksForSubsection } from './drhpExportEngine.js';

// ─── Source registry ────────────────────────────────────────────────────────
// `route` is a real route in client/src/App.jsx — used both for citations and
// for the "[Open X]" navigation actions the assistant offers.

export const SOURCE_REGISTRY = {
  company_profile: {
    label: 'Company Profile (Intake → Company Details)',
    route: '/intake?step=company_details',
    keywords: ['company name', 'legal name', 'cin', 'pan', 'gstin', 'gst number', 'incorporat', 'registered office', 'registered address', 'company address', 'industry', 'company profile', 'about the company', 'about our company', 'entity', 'exchange', 'listing on', 'nic code', 'website', 'authorized capital', 'paid up', 'paid-up', 'corporate office', 'factory address', 'company details', 'company structure', 'summarize our company', 'summarise our company']
  },
  business_overview: {
    label: 'Business Overview (Intake → Business Overview)',
    route: '/intake?step=business_overview',
    keywords: ['business', 'products', 'services', 'customers', 'suppliers', 'operations', 'manufactur', 'industry analysis', 'competitive', 'swot', 'growth strategy', 'market', 'revenue model', 'verticals', 'what do we do', 'what does the company do', 'capabilit', 'technology', 'geographic']
  },
  financials: {
    label: 'Financial Information (Intake → Financials Summary)',
    route: '/intake?step=financials',
    keywords: ['revenue', 'turnover', 'profit', 'pat', 'ebitda', 'margin', 'net worth', 'networth', 'financial', 'fy23', 'fy24', 'fy25', 'fy 2023', 'fy 2024', 'fy 2025', 'debt', 'balance sheet', 'income', 'earnings', 'topline', 'bottom line', 'financials']
  },
  promoters: {
    label: 'Promoters & Directors (Intake → Promoters)',
    route: '/intake?step=promoters',
    keywords: ['promoter', 'promoters', 'director', 'directors', 'board', 'management', 'founder', 'shareholder name', 'din', 'key personnel', 'who owns', 'who runs']
  },
  capital_structure: {
    label: 'Capital Structure (Intake → Capital Structure)',
    route: '/intake?step=capital_structure',
    keywords: ['capital structure', 'shareholding', 'share holding', 'equity', 'shares', 'cap table', 'lock-in', 'lock in', 'dilution', 'holding %', 'holding percentage', 'stake', 'ownership']
  },
  objects: {
    label: 'Objects of the Issue (Intake → Objects)',
    route: '/intake?step=objects',
    keywords: ['objects of the issue', 'objects', 'use of proceeds', 'proceeds', 'raise', 'issue size', 'fund deployment', 'deployment', 'utilisation', 'utilization', 'why are we raising', 'purpose of the issue']
  },
  rpt: {
    label: 'Related Party Transactions (Intake → RPT)',
    route: '/intake?step=rpt',
    keywords: ['related party', 'rpt', 'arm', 'related-party', 'transactions with promoter']
  },
  risk_information: {
    label: 'Risk Information (Intake → Risk Information)',
    route: '/intake?step=risk_information',
    keywords: ['risk factor', 'risk factors', 'risks', 'risk information', 'concentration', 'customer concentration', 'single facility', 'single factory', 'tax demand', 'exposure', 'threat']
  },
  litigation: {
    label: 'Litigation & Disputes (Intake → Litigation)',
    route: '/intake?step=litigation',
    keywords: ['litigation', 'lawsuit', 'legal proceeding', 'dispute', 'court', 'case', 'appeal', 'cit(a)', 'tax dispute', 'pending case', 'claims']
  },
  legal_compliance: {
    label: 'Legal & Compliance (Intake → Legal Compliance)',
    route: '/intake?step=legal_compliance',
    keywords: ['auditor', 'merchant banker', 'lead manager', 'statutory approval', 'licence', 'license', 'factory licen', 'pollution', 'noc', 'legal compliance', 'registrar', 'rta']
  },
  other_disclosures: {
    label: 'Other Disclosures (Intake → Other Disclosures)',
    route: '/intake?step=other_disclosures',
    keywords: ['dividend', 'esop', 'csr', 'group compan', 'material contract', 'other disclosure', 'brlm']
  },
  documents: {
    label: 'Document Repository (Intake → Uploads)',
    route: '/intake',
    keywords: ['document', 'documents', 'upload', 'uploaded', 'aoa', 'moa', 'articles of association', 'memorandum', 'board resolution', 'certificate', 'coi', 'pdf', 'file', 'attachment', 'evidence', 'missing doc', 'which doc']
  },
  compliance: {
    label: 'Compliance Checklist',
    route: '/compliance-checklist',
    // AOA / MOA / board resolution are themselves named compliance rules
    // (RULE-001/002/004), so a question about them is a compliance question.
    keywords: ['compliance', 'rule-', 'rule ', 'sebi rule', 'icdr', 'checklist', 'eligibility', 'regulation', 'reg 6', 'statutory requirement', 'pass', 'fail', 'failed', 'why did rule', 'requirement', 'aoa', 'moa', 'articles of association', 'memorandum', 'board resolution', 'lock-in']
  },
  gaps: {
    label: 'Gap Analysis',
    route: '/gap-analysis',
    keywords: ['gap', 'gaps', 'mismatch', 'discrepanc', 'inconsistenc', 'blocker', 'open issue', 'remediation', 'unresolved', 'critical issue']
  },
  readiness: {
    label: 'IPO Readiness',
    route: '/readiness',
    keywords: ['readiness', 'ready', 'score', 'percentage', '%', 'how ready', 'points', 'progress', 'reach 100', 'what should i do next', 'what to do next', 'next step', 'fix first', 'priority']
  },
  draft_prospectus: {
    label: 'Draft Prospectus (DRHP)',
    route: '/draft',
    keywords: ['draft', 'prospectus', 'drhp', 'chapter', 'section', 'disclosure text', 'what does the draft', 'what does section', 'summarize this chapter', 'summarise this chapter', 'red herring', 'document say']
  },
  reviewer: {
    label: 'Reviewer Workspace',
    route: '/reviewer',
    keywords: ['reviewer', 'review', 'comment', 'comments', 'approv', 'certif', 'reject', 'sign-off', 'sign off', 'changes requested', 'merchant banker said', 'feedback', 'pending review', 'who certified']
  },
  verification: {
    label: 'Fraud & Verification',
    route: '/fraud-verification',
    reviewerOnly: true,
    keywords: ['verif', 'fraud', 'authenticity', 'gst verification', 'pan verification', 'mca', 'identity', 'cross-verif', 'cross verif', 'genuine', 'authentic']
  },
  sebi_updates: {
    label: 'SEBI Updates',
    route: '/sebi-updates',
    keywords: ['sebi update', 'sebi notice', 'circular', 'new regulation', 'regulatory update', 'sebi news', 'latest sebi']
  },
  activity: {
    label: 'Recent Activity (Audit Trail)',
    route: '/dashboard',
    keywords: ['recent', 'changed recently', 'what changed', 'history', 'audit', 'activity', 'who edited', 'last updated', 'timeline of changes', 'log']
  }
};

// Questions that are about IPO/SEBI concepts in general rather than this
// company's data. "What is a DRHP?" is general; "What is OUR DRHP?" is not.
const COMPANY_SCOPE_MARKERS = ['our', 'we ', 'we?', 'us ', 'my ', 'the company', 'this company', 'this chapter', 'this section', 'this page', 'current'];
const GENERAL_QUESTION_PATTERNS = [
  /^what (is|are) (a|an|the)\b/i,
  /^what does .* mean/i,
  /^explain (what|how) (a|an|the)\b/i,
  /^define\b/i,
  /^how does .* work/i
];

export function isGeneralKnowledgeQuestion(question) {
  const q = String(question || '').toLowerCase().trim();
  if (COMPANY_SCOPE_MARKERS.some(m => q.includes(m))) return false;
  return GENERAL_QUESTION_PATTERNS.some(re => re.test(q));
}

// Keywords must match at a word boundary, otherwise short ones produce absurd
// false positives — "din" (promoter DIN) matches inside "rea-din-ess" and would
// drag Promoters into every readiness question. Keywords are stems, so only the
// LEADING boundary is enforced ("certif" still matches "certified"); very short
// ones also get a trailing boundary so "pat" can't match "path".
const KEYWORD_RE_CACHE = new Map();
function keywordMatches(text, keyword) {
  let re = KEYWORD_RE_CACHE.get(keyword);
  if (!re) {
    const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`\\b${esc}${keyword.length <= 3 ? '\\b' : ''}`, 'i');
    KEYWORD_RE_CACHE.set(keyword, re);
  }
  return re.test(text);
}

// Route the user is currently on -> the source that page represents, so
// "what are the open issues here?" resolves against the right module.
const PATH_SOURCE = [
  ['/intake', 'company_profile'],
  ['/compliance-checklist', 'compliance'],
  ['/gap-analysis', 'gaps'],
  ['/readiness', 'readiness'],
  ['/draft-preview', 'draft_prospectus'],
  ['/draft', 'draft_prospectus'],
  ['/reviewer', 'reviewer'],
  ['/fraud-verification', 'verification'],
  ['/sebi-updates', 'sebi_updates']
];

/**
 * Picks the minimum set of sources needed for this question.
 * Falls back to the previous turn's sources for pronoun-only follow-ups
 * ("why did it increase?"), which is what makes multi-turn work without
 * re-sending the entire workspace every message.
 */
export function detectSources(question, { previousQuestion = '', pathname = '', role = 'issuer' } = {}) {
  const q = String(question || '').toLowerCase();

  const score = (text) => {
    const hits = [];
    for (const [id, meta] of Object.entries(SOURCE_REGISTRY)) {
      if (meta.reviewerOnly && role !== 'reviewer') continue;
      const matches = meta.keywords.filter(k => keywordMatches(text, k)).length;
      if (matches > 0) hits.push({ id, matches });
    }
    return hits.sort((a, b) => b.matches - a.matches).map(h => h.id);
  };

  let selected = score(q);

  // Follow-up with no topical keywords of its own — inherit last turn's topic.
  if (selected.length === 0 && previousQuestion) {
    selected = score(String(previousQuestion).toLowerCase());
  }

  // The page the user is looking at is always relevant context.
  const pageSource = PATH_SOURCE.find(([p]) => pathname.startsWith(p))?.[1];
  if (pageSource && !selected.includes(pageSource)) {
    const meta = SOURCE_REGISTRY[pageSource];
    if (!meta.reviewerOnly || role === 'reviewer') selected.push(pageSource);
  }

  // Readiness questions are meaningless without their inputs.
  if (selected.includes('readiness')) {
    for (const dep of ['compliance', 'gaps', 'documents']) {
      if (!selected.includes(dep)) selected.push(dep);
    }
  }
  // "Why did this rule fail?" needs the evidence documents.
  if (selected.includes('compliance') && !selected.includes('documents')) selected.push('documents');
  // Gap answers reference the intake values they contradict.
  if (selected.includes('gaps') && !selected.includes('documents')) selected.push('documents');
  // "Which documents are MISSING?" cannot be answered from the upload list
  // alone — that only shows what exists. The Compliance Checklist is the app's
  // source of truth for which documents are actually required, so an
  // absence-flavoured document question needs both.
  if (selected.includes('documents') && !selected.includes('compliance')
      && /\b(missing|pending|required|outstanding|absent|not uploaded|need|lacking|left)\b/.test(q)) {
    selected.push('compliance');
  }

  // Cap breadth so one broad question can't drag in the whole workspace.
  return selected.slice(0, 6);
}

// ─── Loaders ────────────────────────────────────────────────────────────────
// Each returns a compact string, or null when the workspace genuinely holds
// nothing for that source (the prompt then tells the model to say so).

const truncate = (s, n) => {
  const str = String(s ?? '');
  return str.length > n ? str.slice(0, n) + '…' : str;
};

function fmtObject(obj, { max = 1400 } = {}) {
  if (!obj || Object.keys(obj).length === 0) return null;
  const lines = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `  - ${k.replace(/_/g, ' ')}: ${truncate(typeof v === 'object' ? JSON.stringify(v) : v, 300)}`);
  if (lines.length === 0) return null;
  return truncate(lines.join('\n'), max);
}

function blockToText(b) {
  if (!b) return '';
  if (b.text) return truncate(b.text, 500);
  if (b.title) return `[${b.type}] ${b.title}`;
  return `[${b.type}]`;
}

const LOADERS = {
  company_profile: ({ intake, company }) => {
    const cd = { ...(intake.company_details || {}) };
    const base = fmtObject(cd);
    const fallback = company && (company.legal_name || company.name)
      ? `  - legal name (company record): ${company.legal_name || company.name}`
      : null;
    return base || fallback;
  },
  business_overview: ({ intake }) => fmtObject(intake.business_overview, { max: 2000 }),
  financials: ({ intake, docs }) => {
    const fin = fmtObject(intake.financials);
    const finDoc = docs.find(d => d.doc_type === 'audited_financials');
    const docPart = finDoc
      ? `\n  Audited financials document on file: ${finDoc.name} (status: ${finDoc.status})\n  Values extracted from that document: ${JSON.stringify(finDoc.extracted_values || {})}`
      : '\n  No audited financials document uploaded.';
    return fin ? fin + docPart : (finDoc ? `  (No financial figures entered in the Intake Form.)${docPart}` : null);
  },
  promoters: ({ intake }) => fmtObject({ ...(intake.promoters || {}) }, { max: 1500 }),
  capital_structure: ({ intake, docs }) => {
    const cap = fmtObject(intake.capital_structure);
    const capDoc = docs.find(d => d.doc_type === 'cap_table');
    const docPart = capDoc ? `\n  Cap table document on file: ${capDoc.name}; extracted: ${JSON.stringify(capDoc.extracted_values || {})}` : '';
    return cap ? cap + docPart : null;
  },
  objects: ({ intake }) => fmtObject(intake.objects),
  rpt: ({ intake }) => fmtObject(intake.rpt),
  risk_information: ({ intake }) => fmtObject(intake.risk_information),
  litigation: ({ intake, docs }) => {
    const lit = fmtObject(intake.litigation);
    const litDocs = docs.filter(d => d.doc_type === 'litigation_records');
    const docPart = litDocs.length
      ? `\n  Litigation documents: ${litDocs.map(d => `${d.name} — ${JSON.stringify(d.extracted_values || {})}`).join('; ')}`
      : '';
    return lit ? lit + docPart : (docPart || null);
  },
  legal_compliance: ({ intake }) => fmtObject(intake.legal_compliance),
  other_disclosures: ({ intake }) => fmtObject(intake.other_disclosures),

  documents: ({ docs }) => {
    if (!docs || docs.length === 0) return '  No documents have been uploaded for this company.';
    return docs.map(d =>
      `  - ${d.name} | type: ${d.doc_type} | upload status: ${d.status}` +
      (d.verification_status ? ` | reviewer verification: ${d.verification_status}` : '') +
      (d.extracted_values && Object.keys(d.extracted_values).length
        ? ` | extracted fields: ${Object.keys(d.extracted_values).join(', ')}`
        : ' | no extracted fields')
    ).join('\n');
  },

  compliance: ({ readiness }) => {
    const rules = readiness?.stages?.compliance?.rules;
    if (!rules || rules.length === 0) {
      return '  Compliance checklist has not produced any results yet (no intake data or documents to evaluate).';
    }
    const header = `  Compliance stage score: ${readiness.stages.compliance.score}/${readiness.stages.compliance.max}`;
    const body = rules.map(r =>
      `  - ${r.id ? r.id + ' — ' : ''}${r.name}: ${r.status}` +
      (r.category ? ` (category: ${r.category})` : '') +
      (r.rule ? ` | regulation: ${r.rule}` : '') +
      (r.evidence ? ` | evidence: ${truncate(r.evidence, 200)}` : '') +
      (r.sourceDocument ? ` | source document: ${r.sourceDocument}` : '') +
      (r.validationResult ? ` | result: ${truncate(r.validationResult, 200)}` : '')
    ).join('\n');
    return `${header}\n${body}`;
  },

  gaps: ({ gapReport, readiness }) => {
    const live = (gapReport || []).map(g =>
      `  - [${g.severity || 'medium'}] ${g.id}: ${truncate(g.message, 300)}` +
      (g.fieldName ? ` | field: ${g.fieldName}` : '') +
      (g.intakeValue ? ` | intake value: ${g.intakeValue}` : '') +
      (g.docValue && g.docValue !== 'N/A' ? ` | document value: ${g.docValue}` : '') +
      (g.docName && g.docName !== 'N/A' ? ` | source document: ${g.docName}` : '')
    );
    const checks = (readiness?.stages?.gapAnalysis?.checks || []).map(c =>
      `  - ${c.title}: ${!c.applicable ? 'not yet applicable' : c.resolved ? 'resolved' : 'OPEN'}` +
      (c.description ? ` — ${truncate(c.description, 200)}` : '')
    );
    if (live.length === 0 && checks.length === 0) return '  No gaps detected and no gap checks are applicable yet.';
    return [
      live.length ? `  Detected discrepancies (live consistency engine):\n${live.join('\n')}` : '  No live discrepancies currently detected.',
      checks.length ? `  Remediation checks (Gap Analysis stage, ${readiness?.stages?.gapAnalysis?.score}/${readiness?.stages?.gapAnalysis?.max} pts):\n${checks.join('\n')}` : ''
    ].filter(Boolean).join('\n');
  },

  readiness: ({ readiness }) => {
    if (!readiness) {
      return '  Readiness data was not supplied with this request. Do not state or estimate a score; tell the user to open the IPO Readiness page.';
    }
    const s = readiness.stages;
    return [
      `  Overall: ${readiness.score}/100 (${readiness.status || ''}) — ${readiness.remainingPoints} points remaining.`,
      `  Stage scores: Intake ${s.intake.score}/${s.intake.max}; Compliance ${s.compliance.score}/${s.compliance.max}; Gap Analysis ${s.gapAnalysis.score}/${s.gapAnalysis.max}; Reviewer Certification ${s.certification.score}/${s.certification.max}.`,
      (s.certification.chapters || []).length
        ? `  Certification per chapter: ${s.certification.chapters.map(c => `${c.label} [${c.status}]`).join('; ')}`
        : '',
      (readiness.nextActions || []).length
        ? `  Recommended next actions (highest impact first): ${readiness.nextActions.map(a => `${a.description} (+${a.pointsRemaining} pts, ${a.label} stage)`).join(' | ')}`
        : ''
    ].filter(Boolean).join('\n');
  },

  draft_prospectus: ({ drafts, intake, question }) => {
    if (!drafts || Object.keys(drafts).length === 0) return '  No DRHP chapters have been generated yet.';
    const q = String(question || '').toLowerCase();

    // If the question names a specific section/subsection, return that content
    // verbatim from the same source the Draft Preview renders.
    const numMatch = q.match(/\b(\d+)\.(\d+)\b/);
    let targeted = null;
    for (let si = 0; si < DRHP_HIERARCHY.length; si++) {
      const sec = DRHP_HIERARCHY[si];
      const subs = sec.subsections && sec.subsections.length ? sec.subsections : [{ id: sec.id, title: sec.title, key: sec.key }];
      for (let bi = 0; bi < subs.length; bi++) {
        const sub = subs[bi];
        const numberLabel = `${si + 1}.${bi + 1}`;
        const titleHit = sub.title && q.includes(sub.title.toLowerCase().slice(0, 18));
        const numHit = numMatch && numMatch[0] === numberLabel;
        if (titleHit || numHit) {
          const blocks = getExportBlocksForSubsection(sub.id, sub.key, drafts, intake) || [];
          targeted = `  Section ${numberLabel} — ${sub.title} (chapter key: ${sub.key}, status: ${drafts[sub.key]?.status || 'draft'}):\n` +
            truncate(blocks.map(blockToText).filter(Boolean).join('\n  '), 2500);
          break;
        }
      }
      if (targeted) break;
    }
    if (targeted) return targeted;

    // Otherwise: chapter inventory + the text of chapters the question mentions.
    const inventory = Object.entries(drafts)
      .map(([key, d]) => `  - ${key}: status ${d?.status || 'draft'}, ${(d?.blocks || []).length} content blocks`)
      .join('\n');
    const mentioned = Object.entries(drafts).filter(([key]) => q.includes(key.replace(/_/g, ' ')) || q.includes(key));
    const detail = mentioned.length
      ? '\n  Content of the chapter(s) referenced in the question:\n' +
        mentioned.map(([key, d]) => `  [${key}]\n  ` + truncate((d.blocks || []).map(blockToText).filter(Boolean).join('\n  '), 2000)).join('\n')
      : '';
    return `  DRHP chapter inventory:\n${inventory}${detail}`;
  },

  reviewer: ({ drafts, comments }) => {
    const statuses = Object.entries(drafts || {})
      .map(([key, d]) => `  - ${key}: ${d?.status || 'draft'}` + (d?.certified_by ? ` (certified by ${d.certified_by}${d.certified_at ? ' on ' + d.certified_at : ''})` : ''))
      .join('\n');
    const open = (comments || []).filter(c => c.status !== 'resolved');
    const commentBlock = open.length
      ? open.map(c => `  - [${c.section_id || 'general'}] ${c.author || 'User'} (${c.role || 'user'}, ${c.type || 'note'}): ${truncate(c.content, 300)}`).join('\n')
      : '  No unresolved reviewer comments.';
    return `  Chapter review/certification status:\n${statuses || '  No chapters yet.'}\n  Open comments:\n${commentBlock}`;
  },

  verification: ({ verifications }) => {
    if (!verifications || verifications.length === 0) {
      return '  No verification checks have been run or recorded yet in the Fraud & Verification module.';
    }
    return verifications.map(v =>
      `  - ${v.type}: status ${v.status}` +
      (v.lastRunAt ? `, last run ${v.lastRunAt} by ${v.lastRunBy}` : ', never run') +
      ((v.result?.comparisonRows || []).some(r => r.status === 'Mismatch')
        ? ` | mismatched fields: ${v.result.comparisonRows.filter(r => r.status === 'Mismatch').map(r => r.field).join(', ')}`
        : '')
    ).join('\n');
  },

  sebi_updates: ({ sebiNotices }) => {
    if (!sebiNotices || sebiNotices.length === 0) return '  No SEBI updates are currently cached.';
    return sebiNotices.slice(0, 6).map(n => `  - ${n.title || n.headline || 'Notice'}${n.date ? ` (${n.date})` : ''}${n.summary ? ` — ${truncate(n.summary, 200)}` : ''}`).join('\n');
  },

  activity: ({ auditLogs }) => {
    if (!auditLogs || auditLogs.length === 0) return '  No recent activity recorded.';
    return auditLogs.slice(0, 12).map(l =>
      `  - ${l.created_at || ''} ${l.actor_name || 'Someone'} (${l.actor_role || ''}): ${truncate(l.description || l.action, 200)}`
    ).join('\n');
  }
};

/** Runs the loaders for the selected sources against live workspace data. */
export function retrieveSources(sourceIds, bundle) {
  const out = [];
  for (const id of sourceIds) {
    const meta = SOURCE_REGISTRY[id];
    if (!meta) continue;
    if (meta.reviewerOnly && bundle.role !== 'reviewer') continue;
    let content = null;
    try {
      content = LOADERS[id] ? LOADERS[id](bundle) : null;
    } catch (err) {
      console.warn(`[Copilot] retrieval failed for source "${id}":`, err.message);
      content = null;
    }
    out.push({
      id,
      label: meta.label,
      route: meta.route,
      content: content || `  (No data recorded in the workspace for ${meta.label}.)`
    });
  }
  return out;
}

/** Formats retrieved slices into the labeled block the model reasons over. */
export function buildContextBlock(retrieved) {
  if (!retrieved || retrieved.length === 0) {
    return 'No company-specific sources were retrieved for this question.';
  }
  return retrieved.map(r =>
    `### SOURCE: ${r.label}\n(cite as a markdown link to ${r.route})\n${r.content}`
  ).join('\n\n');
}
