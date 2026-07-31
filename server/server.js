import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Helper to authenticate mock token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: Missing Token' });
  
  const email = token.replace('mock-token-for-', '');
  const user = db.getUsers().find(u => u.email === email);
  if (!user) return res.status(401).json({ message: 'Unauthorized: Invalid Token' });
  
  req.user = user;
  next();
};

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.getUsers().find(u => u.email === email && u.password === password);
  if (!user) return res.status(400).json({ message: 'Invalid email or password.' });
  
  const token = `mock-token-for-${user.email}`;
  res.json({ token, user: { email: user.email, role: user.role, name: user.name } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { email: req.user.email, role: req.user.role, name: req.user.name } });
});

// ----------------------------------------------------
// COMPANIES ENDPOINTS
// ----------------------------------------------------
app.get('/api/companies', authenticateToken, (req, res) => {
  res.json({ companies: db.getCompanies() });
});

app.get('/api/companies/:id', authenticateToken, (req, res) => {
  const company = db.getCompany(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json(company);
});

// Get Company status and metrics (heat map metrics, gaps, comments)
app.get('/api/companies/:id/status', authenticateToken, (req, res) => {
  const companyId = req.params.id;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });

  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  const drafts = db.getDrafts(companyId);

  // Compute stats
  const gapReport = computeGapReport(companyId, intake, docs);
  const sections = Object.keys(drafts);
  const certifiedCount = sections.reduce((acc, sec) => acc + (drafts[sec].status === 'certified' ? 1 : 0), 0);
  
  const openComments = db.getDb().comments.filter(c => c.status === 'active').length;

  // Compute colors for heat map chapters
  const heatmap = {};
  sections.forEach(secKey => {
    const sec = drafts[secKey];
    if (sec.status === 'certified') {
      heatmap[secKey] = 'certified';
    } else {
      // Find if this section has low confidence blocks or gaps
      const hasLowBlock = sec.blocks.some(b => b.confidence === 'low');
      const hasGap = gapReport.some(g => {
        if (secKey === 'objects' && g.fieldName === 'objects.timeline') return true;
        if (secKey === 'capital_structure' && g.fieldName === 'capital_structure.promoter_holding_pct') return true;
        if (secKey === 'financials' && g.fieldName === 'financials.revenue_fy25') return true;
        return false;
      });
      const hasComment = db.getComments(secKey).some(c => c.status === 'active');

      if (hasLowBlock || hasGap) {
        heatmap[secKey] = 'missing'; // Red / Missing
      } else if (hasComment || sec.status === 'clarification_requested' || sec.blocks.some(b => b.confidence === 'medium')) {
        heatmap[secKey] = 'partial'; // Yellow / Partial
      } else {
        heatmap[secKey] = 'complete'; // Green / High confidence
      }
    }
  });

  res.json({
    companyName: company.name,
    completenessPercentage: Math.round((certifiedCount / sections.length) * 100),
    certifiedCount,
    totalSections: sections.length,
    openComments,
    inconsistenciesCount: gapReport.filter(g => g.category === 'consistency').length,
    gapsCount: gapReport.filter(g => g.category === 'gap').length,
    heatmap,
    gapReport
  });
});

// ----------------------------------------------------
// INTAKE QUESTIONNAIRE ENDPOINTS
// ----------------------------------------------------
app.get('/api/intake/:companyId', authenticateToken, (req, res) => {
  res.json(db.getIntake(req.params.companyId));
});

app.get('/api/intake/:companyId/:stepKey', authenticateToken, (req, res) => {
  const intake = db.getIntake(req.params.companyId);
  res.json(intake[req.params.stepKey] || {});
});

app.put('/api/intake/:companyId/:stepKey', authenticateToken, (req, res) => {
  const { companyId, stepKey } = req.params;
  const savedStep = db.saveIntakeStep(companyId, stepKey, req.body);
  
  // Re-run draft generator on this save so that draft update is reactive!
  generateDraftData(companyId);

  res.json({ message: 'Step saved successfully.', data: savedStep });
});

// ----------------------------------------------------
// DOCUMENT MANAGEMENT & OCR PIPELINE ENDPOINTS
// ----------------------------------------------------
app.get('/api/documents/:companyId', authenticateToken, (req, res) => {
  res.json(db.getDocuments(req.params.companyId));
});

app.post('/api/documents/:companyId/upload', authenticateToken, upload.single('file'), (req, res) => {
  const { companyId } = req.params;
  const { doc_type } = req.body;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  // Simulate OCR text extraction based on document type
  let extracted = {};
  if (doc_type === 'audited_financials') {
    extracted = {
      revenue_fy25: '118,000,000', // Predefined discrepancy
      revenue_fy24: '95,000,000',
      revenue_fy23: '72,000,000',
      profit_fy25: '11,000,000',
      net_worth: '45,000,000'
    };
  } else if (doc_type === 'cap_table') {
    extracted = {
      aarav_mehta_shares: '620,000', // Mismatch 62% vs 65% in intake
      rohan_mehta_shares: '350,000',
      other_shares: '30,000',
      total_shares: '1,000,000',
      promoter_holding_pct: '62'
    };
  } else if (doc_type === 'litigation_records') {
    extracted = {
      case_reference: 'CIT(A)/MUM/IT-1124/2024-25',
      authority: 'Commissioner of Income Tax (Appeals), Mumbai',
      disputed_amount: '1,200,000',
      assessment_year: '2022-23'
    };
  } else if (doc_type === 'incorporation_certificate') {
    extracted = {
      cin: 'U29220MH2015PTC263456',
      legal_name: 'Aarav Precision Engineering Private Limited',
      incorporation_date: '2015-04-12'
    };
  }

  const newDoc = {
    id: `doc-${Date.now()}`,
    companyId,
    name: req.file.originalname,
    doc_type,
    status: 'uploaded', // Needs confirmation by Promoter
    uploaded_at: new Date().toISOString(),
    extracted_values: extracted
  };

  const added = db.addDocument(newDoc);
  
  // Refresh drafts
  generateDraftData(companyId);

  res.json(added);
});

app.put('/api/documents/:id/confirm', authenticateToken, (req, res) => {
  const { id } = req.params;
  const doc = db.confirmDocument(id, req.body);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  
  // Re-run draft generator on confirmation so inconsistencies check updates
  generateDraftData(doc.companyId);

  res.json({ message: 'Document data confirmed.', document: doc });
});

app.delete('/api/documents/:id', authenticateToken, (req, res) => {
  const doc = db.getDb().documents.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  const companyId = doc.companyId;

  const success = db.deleteDocument(req.params.id);
  if (!success) return res.status(404).json({ message: 'Document not found' });

  // Re-run draft generator
  generateDraftData(companyId);

  res.json({ message: 'Document deleted successfully.' });
});

// ----------------------------------------------------
// DRAFTS AND AI GENERATOR ENDPOINTS
// ----------------------------------------------------
app.get('/api/drafts/:companyId', authenticateToken, (req, res) => {
  res.json(db.getDrafts(req.params.companyId));
});

// Trigger generation
app.post('/api/drafts/:companyId/generate', authenticateToken, (req, res) => {
  const { companyId } = req.params;
  const section = req.query.section; // Optional filter

  const updatedDrafts = generateDraftData(companyId, section);
  res.json({ message: 'Draft regenerated successfully using AI.', drafts: updatedDrafts });
});

// Update Status (Reviewer Locking / Certifying)
app.put('/api/drafts/:companyId/:sectionKey/status', authenticateToken, (req, res) => {
  const { companyId, sectionKey } = req.params;
  const { status } = req.body; // e.g. certified, locked, draft
  
  try {
    const updated = db.updateSectionStatus(companyId, sectionKey, status, req.user.role);
    res.json(updated);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

// Inconsistencies gap report
app.get('/api/drafts/:companyId/gap-report', authenticateToken, (req, res) => {
  const companyId = req.params.id || req.params.companyId;
  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  const gapReport = computeGapReport(companyId, intake, docs);
  res.json(gapReport);
});

// ----------------------------------------------------
// COMMENTS ENDPOINTS
// ----------------------------------------------------
app.get('/api/comments/:sectionId', authenticateToken, (req, res) => {
  res.json(db.getComments(req.params.sectionId));
});

app.post('/api/comments/:sectionId', authenticateToken, (req, res) => {
  const { sectionId } = req.params;
  const { content, type, block_id } = req.body;
  const comment = db.addComment(sectionId, content, type, req.user.name, req.user.role, block_id);
  res.json(comment);
});

app.put('/api/comments/:commentId/resolve', authenticateToken, (req, res) => {
  const comment = db.resolveComment(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  res.json(comment);
});

// ----------------------------------------------------
// WORD DOCUMENT (.DOCX) EXPORT
// ----------------------------------------------------
app.get('/api/export/:companyId/docx', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });

  const drafts = db.getDrafts(companyId);
  
  // Check if watermark is required (at least one section is not certified)
  const sections = Object.keys(drafts);
  const allCertified = sections.every(sec => drafts[sec].status === 'certified');
  
  const watermarkText = allCertified 
    ? "CERTIFIED COPY - CONFIDENTIAL" 
    : "DRAFT — PENDING PROFESSIONAL REVIEW (AI-ASSISTED)";

  // Construct Word Document
  const docElements = [];

  // Title Page / Cover Page
  docElements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1000, after: 300 },
      children: [
        new TextRun({
          text: "DRAFT OFFER DOCUMENT",
          bold: true,
          size: 32,
          color: "1e293b",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
      children: [
        new TextRun({
          text: company.name.toUpperCase(),
          bold: true,
          size: 40,
          color: "4f46e5",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [
        new TextRun({
          text: "Prepared Aligned with SEBI (ICDR) Regulations for Listing on SME Exchange",
          italic: true,
          size: 24,
          color: "64748b",
        }),
      ],
    })
  );

  // Border disclaimer box
  docElements.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 400, after: 400 },
      children: [
        new TextRun({
          text: "IMPORTANT REGULATORY WARNING / DISCLAIMER\n",
          bold: true,
          color: "dc2626",
          size: 22,
        }),
        new TextRun({
          text: `Status: ${watermarkText}\n\n`,
          bold: true,
          color: allCertified ? "10b981" : "dc2626",
          size: 20,
        }),
        new TextRun({
          text: "This document is an AI-assisted draft generated by IPO Pilot AI based on promoter intake disclosures and mock extracted document values. It does NOT constitute a final legal prospectus, and must be reviewed, finalized, and certified by a registered Merchant Banker and legal counsel prior to filing with SEBI, BSE SME, or NSE Emerge.",
          italic: true,
          size: 18,
          color: "334155",
        }),
      ],
    })
  );

  // Page Break
  docElements.push(
    new Paragraph({
      children: [new TextRun({ text: "", pageBreakBefore: true })],
    })
  );

  // Table of Contents title
  docElements.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: "Table of Chapters",
          bold: true,
          size: 28,
          color: "1e293b",
        }),
      ],
    })
  );

  // Add all sections to the word document
  const sectionMapping = {
    business_overview: "Chapter 1: Business Overview",
    risk_factors: "Chapter 2: Risk Factors",
    objects: "Chapter 3: Objects of the Issue",
    capital_structure: "Chapter 4: Capital Structure",
    related_party: "Chapter 5: Related Party Transactions",
    litigation: "Chapter 6: Litigation & Legal Proceedings",
    promoter_details: "Chapter 7: Promoter & Management Details"
  };

  Object.keys(drafts).forEach(secKey => {
    const chapterTitle = sectionMapping[secKey] || secKey.toUpperCase();
    const section = drafts[secKey];

    docElements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 150 },
        children: [
          new TextRun({
            text: chapterTitle,
            bold: true,
            size: 24,
            color: "1e293b",
          }),
          new TextRun({
            text: ` (${section.status.toUpperCase()})`,
            size: 16,
            color: section.status === 'certified' ? "10b981" : "e11d48",
          })
        ],
      })
    );

    section.blocks.forEach(b => {
      docElements.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: b.text,
              size: 22,
            }),
            new TextRun({
              text: ` [Citations: ${b.citations.join(', ')}]`,
              italic: true,
              size: 16,
              color: "6366f1",
            }),
            new TextRun({
              text: ` (${b.confidence.toUpperCase()} CONFIDENCE)`,
              bold: true,
              size: 14,
              color: b.confidence === 'high' ? "10b981" : b.confidence === 'medium' ? "f59e0b" : "ef4444",
            })
          ],
        })
      );
    });
  });

  const wordDoc = new Document({
    sections: [
      {
        properties: {},
        children: docElements,
      },
    ],
  });

  const buffer = await Packer.toBuffer(wordDoc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=IPO_Draft_${company.id}.docx`);
  res.send(buffer);
});

// ----------------------------------------------------
// CORE ENGINE: RE-RUNNABLE GENERATOR & GAP REPORT
// ----------------------------------------------------
function computeGapReport(companyId, intake, docs) {
  const gaps = [];

  // Check 1: Revenue discrepancy
  const intakeRev = intake.financials?.revenue_fy25;
  const finDoc = docs.find(d => d.doc_type === 'audited_financials');
  
  if (intakeRev && finDoc) {
    const docRev = finDoc.extracted_values?.revenue_fy25;
    if (docRev && String(intakeRev) !== String(docRev)) {
      gaps.push({
        id: 'gap-rev-mismatch',
        severity: 'high',
        category: 'consistency',
        fieldName: 'financials.revenue_fy25',
        message: 'Revenue mismatch: Promoter intake states 12.5 Crores, but audited financials document records 11.8 Crores.',
        intakeValue: '125,000,000 INR (12.5 Cr)',
        docValue: '118,000,000 INR (11.8 Cr)',
        docName: finDoc.name
      });
    }
  }

  // Check 2: Promoter shareholding mismatch
  const intakeHolding = intake.capital_structure?.promoter_holding_pct;
  const capDoc = docs.find(d => d.doc_type === 'cap_table');
  if (intakeHolding && capDoc) {
    const docHolding = capDoc.extracted_values?.promoter_holding_pct;
    if (docHolding && String(intakeHolding) !== String(docHolding)) {
      gaps.push({
        id: 'gap-holding-mismatch',
        severity: 'high',
        category: 'consistency',
        fieldName: 'capital_structure.promoter_holding_pct',
        message: 'Promoter Shareholding discrepancy: Promoter intake claims 65.00% ownership, but the certified Cap Table document indicates 62.00%.',
        intakeValue: '65.00%',
        docValue: '62.00%',
        docName: capDoc.name
      });
    }
  }

  // Check 3: Missing fund deployment timeline (Objects of the Issue)
  const objectsTimeline = intake.objects?.timeline;
  if (!objectsTimeline || objectsTimeline.trim() === '') {
    gaps.push({
      id: 'gap-missing-timeline',
      severity: 'medium',
      category: 'gap',
      fieldName: 'objects.timeline',
      message: 'Missing Required Disclosure: The estimated timeline and schedule of fund deployment has not been specified.',
      intakeValue: 'Not specified',
      docValue: 'N/A',
      docName: 'N/A'
    });
  }

  return gaps;
}

function generateDraftData(companyId, sectionKey = null) {
  const currentDb = db.getDb();
  const intake = currentDb.intake[companyId] || {};
  const docs = currentDb.documents.filter(d => d.companyId === companyId);
  const gapReport = computeGapReport(companyId, intake, docs);

  // Dynamic Generation rules
  const currentDrafts = currentDb.drafts[companyId] || {};

  // Business Overview Generator
  const generateBusinessOverview = () => {
    const name = intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
    const industry = intake.company_details?.industry_type || 'Precision Engineering & Manufacturing';
    const products = intake.business_overview?.products || 'precision machinery components';
    const location = intake.company_details?.registered_office || 'Dombivli, Thane';
    const operations = intake.business_overview?.operations || '';
    const customers = intake.business_overview?.customers || '';

    return {
      status: currentDrafts.business_overview?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'bo-1',
          text: `${name} (the "Company") operates in the ${industry} industry. The Company is principally engaged in the production and supply of ${products}.`,
          confidence: 'high',
          citations: ['Intake: Company Details: legal_name', 'Intake: Business Overview: products']
        },
        {
          id: 'bo-2',
          text: `The registered office and primary tooling facility is established at ${location}. ${operations}`,
          confidence: 'high',
          citations: ['Intake: Company Details: registered_office', 'Intake: Business Overview: operations']
        },
        {
          id: 'bo-3',
          text: `Our client base includes critical aerospace, defense, and high-precision hydraulic manufacturers, key among which are ${customers}.`,
          confidence: 'high',
          citations: ['Intake: Business Overview: customers']
        }
      ]
    };
  };

  // Risk Factors Generator
  const generateRiskFactors = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');
    
    const blocks = [
      {
        id: 'rf-1',
        text: 'Our manufacturing operations are heavily concentrated at our single facility in Dombivli, Thane. Any physical shut-down, natural calamity, or utility failure could suspend manufacturing and hurt our operational yield.',
        confidence: 'medium',
        citations: ['Intake: Business Overview: operations']
      }
    ];

    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc) cite.push(`Document: ${litDoc.name}`);
      blocks.push({
        id: 'rf-2',
        text: `We are subject to ongoing tax litigation: ${details}. An adverse ruling in this tax appeal could lead to a liability of up to INR 1,200,000, impacting our overall profits.`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.risk_factors?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  // Objects of the Issue Generator
  const generateObjects = () => {
    const amount = intake.objects?.amount_to_raise || '50,000,000';
    const purpose = intake.objects?.purpose || '';
    const timeline = intake.objects?.timeline || '';

    const blocks = [
      {
        id: 'obj-1',
        text: `The Company proposes to raise capital amounting to INR ${Number(amount).toLocaleString('en-IN')} through the public issue. The primary objects of the issue are: ${purpose}.`,
        confidence: 'high',
        citations: ['Intake: Objects: amount_to_raise', 'Intake: Objects: purpose']
      }
    ];

    const hasTimelineGap = gapReport.some(g => g.fieldName === 'objects.timeline');
    if (hasTimelineGap) {
      blocks.push({
        id: 'obj-2',
        text: `CRITICAL GAP WARNING: The estimated timeline and schedule of funds deployment has not been specified by the Issuer. SEBI compliance requires a detailed year-by-year deployment timeline.`,
        confidence: 'low',
        citations: ['Intake: Objects: timeline']
      });
    } else {
      blocks.push({
        id: 'obj-2',
        text: `The funds raised through this Issue are proposed to be deployed as follows: ${timeline}.`,
        confidence: 'high',
        citations: ['Intake: Objects: timeline']
      });
    }

    return {
      status: currentDrafts.objects?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  // Capital Structure Generator
  const generateCapitalStructure = () => {
    const totalShares = intake.capital_structure?.total_shares || '1,000,000';
    const holdingPct = intake.capital_structure?.promoter_holding_pct || '65';
    
    const capDoc = docs.find(d => d.doc_type === 'cap_table');
    const isDocConfirmed = capDoc && capDoc.status === 'confirmed';

    const blocks = [
      {
        id: 'cap-1',
        text: `The pre-IPO paid up share capital of the company is comprised of ${Number(totalShares).toLocaleString('en-IN')} equity shares of face value Rs 10 each.`,
        confidence: 'high',
        citations: ['Intake: Capital Structure: total_shares']
      }
    ];

    const hasHoldingMismatch = gapReport.some(g => g.fieldName === 'capital_structure.promoter_holding_pct');
    
    if (hasHoldingMismatch) {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (capDoc) cite.push(`Document: ${capDoc.name}`);
      blocks.push({
        id: 'cap-2',
        text: `WARNING (Data Mismatch): A discrepancy has been detected in promoter shareholding disclosures. The intake form lists promoter holding as ${holdingPct}%, but the uploaded Cap Table document shows promoter holding is actually ${capDoc.extracted_values?.promoter_holding_pct || '62'}% (comprising ${capDoc.extracted_values?.aarav_mehta_shares || '620,000'} shares held by Aarav Mehta).`,
        confidence: 'low',
        citations: cite
      });
    } else {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (isDocConfirmed) cite.push(`Document: ${capDoc.name}`);
      blocks.push({
        id: 'cap-2',
        text: `The Promoter holding post verification is certified at ${holdingPct}% of pre-IPO paid up capital, representing Aarav Mehta holding 62% and Rohan Mehta holding 35% of the shares.`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.capital_structure?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  // Related Party Transactions Generator
  const generateRelatedParty = () => {
    const rptDetails = intake.rpt?.rpt_details || '';
    return {
      status: currentDrafts.related_party?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'rp-1',
          text: `The company has entered into transaction agreements with related parties, specifically: ${rptDetails}`,
          confidence: 'high',
          citations: ['Intake: Related Party Transactions: rpt_details']
        }
      ]
    };
  };

  // Litigation Generator
  const generateLitigation = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');

    const blocks = [
      {
        id: 'lit-1',
        text: 'Other than the proceeding detailed below, there are no material legal proceedings, criminal records, or tax litigation filed against the promoters, directors, or company.',
        confidence: 'high',
        citations: ['Intake: Litigation: has_litigation']
      }
    ];

    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc) cite.push(`Document: ${litDoc.name}`);
      blocks.push({
        id: 'lit-2',
        text: `Income Tax Appeal: ${details}`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.litigation?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  // Promoter Details Generator
  const generatePromoters = () => {
    const list = intake.promoters?.promoters_list || '';
    const board = intake.promoters?.directors || '';

    return {
      status: currentDrafts.promoter_details?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'prom-1',
          text: `The profile and details of our promoters are as follows: ${list}`,
          confidence: 'high',
          citations: ['Intake: Promoters: promoters_list']
        },
        {
          id: 'prom-2',
          text: `The current Board of Directors is structured with the following directors: ${board}`,
          confidence: 'high',
          citations: ['Intake: Promoters: directors']
        }
      ]
    };
  };

  // Update drafts
  if (!sectionKey || sectionKey === 'business_overview') currentDrafts.business_overview = generateBusinessOverview();
  if (!sectionKey || sectionKey === 'risk_factors') currentDrafts.risk_factors = generateRiskFactors();
  if (!sectionKey || sectionKey === 'objects') currentDrafts.objects = generateObjects();
  if (!sectionKey || sectionKey === 'capital_structure') currentDrafts.capital_structure = generateCapitalStructure();
  if (!sectionKey || sectionKey === 'related_party') currentDrafts.related_party = generateRelatedParty();
  if (!sectionKey || sectionKey === 'litigation') currentDrafts.litigation = generateLitigation();
  if (!sectionKey || sectionKey === 'promoter_details') currentDrafts.promoter_details = generatePromoters();

  db.saveDrafts(companyId, currentDrafts);
  return currentDrafts;
}

// Start Server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`IPO Pilot AI backend running on http://localhost:${PORT}`);
});
