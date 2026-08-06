import React from 'react';
import { 
  Building2, 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  QrCode, 
  Globe, 
  Mail, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Info,
  Bookmark,
  Award,
  Layers
} from 'lucide-react';

/**
 * Fixed Front Matter Template for Final SEBI DRHP Export
 * Pages 1-3 are strictly template-driven (not AI-generated)
 * Followed by Table of Contents (Page 4) and AI DRHP chapters
 */
export default function FrontMatterTemplate({ company = {}, issueDetails = {}, stats = {} }) {
  const compName = company.name || 'AARAV PRECISION ENGINEERING LIMITED';
  const formerName = company.formerName || 'Aarav Precision Engineering Private Limited';
  const cin = company.cin || 'U29220MH2015PTC263456';
  const regOffice = company.address || company.regOffice || 'Plot W-42, MIDC Industrial Area, Dombivli East, Thane - 421203, Maharashtra, India';
  const corpOffice = company.corpOffice || regOffice;
  const website = company.website || 'www.aaravprecision.com';
  const email = company.email || 'investors@aaravprecision.com';
  const contactNo = company.contactNo || '+91 251 287 4400';
  const complianceOfficer = company.complianceOfficer || 'Rohan Sharma, Company Secretary & Compliance Officer';
  const promoters = company.promoters || 'Aarav Mehta & Sunita Mehta';
  
  const issueTitle = issueDetails.title || 'INITIAL PUBLIC OFFERING OF UP TO 4,000,000 EQUITY SHARES';
  const freshIssue = issueDetails.freshIssue || 'Up to 4,000,000 Equity Shares aggregating up to ₹1,200.00 Million';
  const ofs = issueDetails.ofs || 'NIL (100% Fresh Issue by Issuer Company)';
  const faceValue = issueDetails.faceValue || '₹10.00 per Equity Share';
  const exchange = issueDetails.exchange || 'NSE Emerge (National Stock Exchange of India Limited)';
  const brlm = issueDetails.brlm || 'GYR Capital Advisors Private Limited';
  const registrar = issueDetails.registrar || 'Bigshare Services Private Limited';
  const draftDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-12 font-serif text-slate-900 leading-relaxed select-none">

      {/* ==================================================== */}
      {/* PAGE 1 — FIXED COVER PAGE                            */}
      {/* ==================================================== */}
      <div className="bg-white border-2 border-slate-900 p-8 md:p-14 space-y-8 min-h-[1050px] shadow-2xl relative flex flex-col justify-between font-serif">
        
        {/* Top SEBI DRHP Regulatory Banner */}
        <div className="border-b-2 border-slate-900 pb-4 text-center space-y-2">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-700">
            DRAFT RED HERRING PROSPECTUS
          </p>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Dated {draftDate} | Version 1.0 (Final Export) · SEBI (ICDR) Regulations, 2018 (Schedule VI)
          </p>
          <div className="bg-slate-100 py-1 px-3 border border-slate-300 rounded text-[9px] font-mono font-semibold text-slate-700 uppercase tracking-wider inline-block">
            Please read Section 32 of the Companies Act, 2013 and SEBI (ICDR) Regulations
          </div>
        </div>

        {/* Company Identity Block */}
        <div className="text-center space-y-3 py-4 border-b border-slate-200">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 bg-indigo-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md border-2 border-indigo-700">
              <Building2 className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-wide uppercase font-serif">
            {compName.toUpperCase()}
          </h1>
          {formerName && (
            <p className="text-xs text-slate-600 italic">
              (Originally incorporated under Companies Act, 1956 as "{formerName}")
            </p>
          )}
          <div className="text-[11px] font-mono space-y-1 text-slate-700">
            <p><span className="font-bold text-slate-900">CIN:</span> {cin}</p>
            <p><span className="font-bold text-slate-900">Registered Office:</span> {regOffice}</p>
            <p><span className="font-bold text-slate-900">Corporate Office:</span> {corpOffice}</p>
            <p className="flex items-center justify-center gap-4 text-[10px] text-slate-600 pt-1">
              <span><Globe className="w-3 h-3 inline mr-1 text-indigo-600" />{website}</span>
              <span><Mail className="w-3 h-3 inline mr-1 text-indigo-600" />{email}</span>
              <span><Phone className="w-3 h-3 inline mr-1 text-indigo-600" />{contactNo}</span>
            </p>
          </div>
        </div>

        {/* Issue Details Box */}
        <div className="bg-slate-50 p-6 border border-slate-300 rounded-xl space-y-4 text-center">
          <h2 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">
            OFFER DETAILS & ISSUE STRUCTURE
          </h2>
          <p className="text-xs font-bold text-slate-900 leading-relaxed uppercase">
            {issueTitle} OF FACE VALUE OF {faceValue.toUpperCase()} FOR CASH AT A PRICE OF ₹[•] PER EQUITY SHARE (INCLUDING PREMIUM OF ₹[•] PER EQUITY SHARE) AGGREGATING UP TO ₹1,200.00 MILLION ON SME EXCHANGE.
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs font-sans text-left border-t border-slate-200 pt-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block">Fresh Issue Portion:</span>
              <span className="font-bold text-slate-800">{freshIssue}</span>
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block">Offer For Sale (OFS):</span>
              <span className="font-bold text-slate-800">{ofs}</span>
            </div>
          </div>
        </div>

        {/* Key Intermediaries & Designated Stock Exchange Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden text-xs font-sans">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Book Running Lead Manager</th>
                <th className="p-2.5">Registrar to the Issue</th>
                <th className="p-2.5">Designated SME Exchange</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800 text-[11px]">
              <tr>
                <td className="p-2.5 font-bold text-indigo-900">{brlm}</td>
                <td className="p-2.5 font-bold text-indigo-900">{registrar}</td>
                <td className="p-2.5 font-bold text-slate-900">{exchange}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Disclaimers & QR Code */}
        <div className="border-t-2 border-slate-900 pt-4 flex items-center justify-between text-[9px] font-sans text-slate-600 gap-4">
          <div className="space-y-1 max-w-xl">
            <p className="font-bold text-slate-900 uppercase">REGULATORY NOTICE & RISK WARNING:</p>
            <p className="leading-snug">
              Investment in equity shares involves a high degree of risk. For details, please see "Risk Factors" on page 12 before bidding. A copy of this DRHP has been submitted to SEBI and the Designated SME Stock Exchange.
            </p>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-300 rounded-xl text-center shrink-0">
            <QrCode className="w-10 h-10 text-slate-800 mx-auto" />
            <span className="font-mono text-[8px] block font-bold text-slate-500 mt-1">SEBI FILING VERIFICATION</span>
          </div>
        </div>

      </div>

      {/* ==================================================== */}
      {/* PAGE 2 — FIXED OFFER SNAPSHOT                        */}
      {/* ==================================================== */}
      <div className="bg-white border-2 border-slate-900 p-8 md:p-14 space-y-8 min-h-[1050px] shadow-2xl relative font-sans">
        
        <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-bold text-indigo-600 uppercase tracking-widest">SECTION I</span>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">OFFER SNAPSHOT & ISSUER SUMMARY</h2>
          </div>
          <span className="font-mono text-xs text-slate-400 font-bold">PAGE 2 OF DRHP</span>
        </div>

        {/* Structured Table 1: Corporate Profile Summary */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>1. Corporate Information & Key Contacts</span>
          </h3>
          <table className="w-full text-xs border border-slate-300 rounded-xl overflow-hidden">
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-slate-50">
                <td className="p-2.5 font-mono font-bold text-slate-600 w-1/3">Company Legal Name</td>
                <td className="p-2.5 font-bold text-slate-900">{compName}</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono font-bold text-slate-600">Corporate Identification (CIN)</td>
                <td className="p-2.5 font-mono font-semibold text-indigo-700">{cin}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-mono font-bold text-slate-600">Promoters of Company</td>
                <td className="p-2.5 font-semibold text-slate-800">{promoters}</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono font-bold text-slate-600">Compliance Officer & CS</td>
                <td className="p-2.5 font-medium text-slate-800">{complianceOfficer}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-mono font-bold text-slate-600">Statutory Auditors</td>
                <td className="p-2.5 font-medium text-slate-800">M/s R. K. Doshi & Co. LLP, Chartered Accountants</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Structured Table 2: Issue Structure & Net Allocation */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Issue Structure & Investor Category Allocation</span>
          </h3>
          <table className="w-full text-xs border border-slate-300 rounded-xl overflow-hidden text-left">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Allocation Percentage</th>
                <th className="p-2.5">Number of Shares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              <tr>
                <td className="p-2.5 font-bold text-slate-900">Qualified Institutional Buyers (QIB)</td>
                <td className="p-2.5 font-mono">Not more than 50.00% of Net Issue</td>
                <td className="p-2.5 font-mono font-bold">Up to 1,900,000 Equity Shares</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-bold text-slate-900">Non-Institutional Investors (NII)</td>
                <td className="p-2.5 font-mono">Not less than 15.00% of Net Issue</td>
                <td className="p-2.5 font-mono font-bold">Not less than 570,000 Equity Shares</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-slate-900">Retail Individual Investors (RII)</td>
                <td className="p-2.5 font-mono">Not less than 35.00% of Net Issue</td>
                <td className="p-2.5 font-mono font-bold">Not less than 1,330,000 Equity Shares</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-bold text-indigo-900">Market Maker Reservation</td>
                <td className="p-2.5 font-mono text-indigo-700">5.00% of Gross Issue Size</td>
                <td className="p-2.5 font-mono font-bold text-indigo-900">200,000 Equity Shares</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Structured Table 3: Objects of the Issue Summary */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            <span>3. Objects of the Issue (Use of Proceeds Summary)</span>
          </h3>
          <table className="w-full text-xs border border-slate-300 rounded-xl overflow-hidden text-left">
            <thead className="bg-slate-100 text-slate-700 font-mono text-[10px] uppercase border-b">
              <tr>
                <th className="p-2.5">Object Particulars</th>
                <th className="p-2.5">Estimated Amount (₹ Cr)</th>
                <th className="p-2.5">Deployment Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              <tr>
                <td className="p-2.5 font-bold">Funding Capital Expenditure for CNC Machinery</td>
                <td className="p-2.5 font-mono font-bold text-indigo-700">₹45.00 Cr</td>
                <td className="p-2.5 font-mono">FY26 - FY27</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-bold">Working Capital Expenditure Expansion</td>
                <td className="p-2.5 font-mono font-bold text-indigo-700">₹35.00 Cr</td>
                <td className="p-2.5 font-mono">FY26 - FY27</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold">Repayment / Prepayment of Credit Debt</td>
                <td className="p-2.5 font-mono font-bold text-indigo-700">₹20.00 Cr</td>
                <td className="p-2.5 font-mono">FY26</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="p-2.5 font-bold">General Corporate Purposes & Issue Expenses</td>
                <td className="p-2.5 font-mono font-bold text-indigo-700">₹20.00 Cr</td>
                <td className="p-2.5 font-mono">FY26</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* ==================================================== */}
      {/* PAGE 3 — FIXED IMPORTANT INFORMATION                 */}
      {/* ==================================================== */}
      <div className="bg-white border-2 border-slate-900 p-8 md:p-14 space-y-8 min-h-[1050px] shadow-2xl relative font-sans">
        
        <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-bold text-indigo-600 uppercase tracking-widest">SECTION II</span>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">IMPORTANT INFORMATION & STATUTORY DISCLAIMERS</h2>
          </div>
          <span className="font-mono text-xs text-slate-400 font-bold">PAGE 3 OF DRHP</span>
        </div>

        {/* Mandatory Regulatory Clauses */}
        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          
          <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>1. SEBI Disclaimer Clause</span>
            </h4>
            <p className="text-[11px] leading-relaxed">
              It is to be distinctly understood that submission of this Draft Red Herring Prospectus to SEBI should not in any way be deemed or construed that the same has been cleared or approved by SEBI. SEBI does not take any responsibility either for the financial soundness of any scheme or for the correctness of the statements made or opinions expressed in this Offer Document.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>2. Stock Exchange Disclaimer Clause (NSE Emerge / BSE SME)</span>
            </h4>
            <p className="text-[11px] leading-relaxed">
              Listing of Equity Shares on the SME Exchange is pursuant to SEBI ICDR Regulations. The Stock Exchange has given in-principle permission to list the Equity Shares, but does not guarantee the safety of investment or liquidity of shares.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>3. Investor Grievance & Contact Mechanism</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="font-bold text-slate-900 block">Registrar Helpline:</span>
                <p>{registrar}</p>
                <p className="text-slate-500 font-mono">Email: ipo@bigshareonline.com</p>
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Company Compliance Officer:</span>
                <p>{complianceOfficer}</p>
                <p className="text-slate-500 font-mono">Email: {email}</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* PAGE 4 — TABLE OF CONTENTS                           */}
      {/* ==================================================== */}
      <div className="bg-white border-2 border-slate-900 p-8 md:p-14 space-y-6 min-h-[1050px] shadow-2xl relative font-serif">
        
        <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">TABLE OF CONTENTS</h2>
          <span className="font-mono text-xs text-slate-400 font-bold font-sans">PAGE 4 OF DRHP</span>
        </div>

        <div className="space-y-2 font-sans text-xs">
          
          {/* Front Matter Pages */}
          <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl flex justify-between font-bold text-indigo-950">
            <span>Front Matter — Cover Page & Issue Snapshot</span>
            <span className="font-mono">Pages 1 – 3</span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between font-bold text-slate-800">
            <span>Table of Contents</span>
            <span className="font-mono">Page 4</span>
          </div>

          {/* DRHP Chapters */}
          {[
            { title: 'Section I: Definitions & Abbreviations', page: 'Page 5' },
            { title: 'Section II: Certain Conventions & Industry Presentation', page: 'Page 7' },
            { title: 'Section III: Risk Factors (Internal & External)', page: 'Page 12' },
            { title: 'Section IV: Summary of the Offer Document', page: 'Page 20' },
            { title: 'Section V: General Information & Capital Structure', page: 'Page 24' },
            { title: 'Section VI: Objects of the Offer', page: 'Page 30' },
            { title: 'Section VII: Basis for Offer Price & Special Tax Benefits', page: 'Page 36' },
            { title: 'Section VIII: Industry Overview', page: 'Page 40' },
            { title: 'Section IX: Our Business Operations & Strategy', page: 'Page 44' },
            { title: 'Section X: Key Regulations & Statutory Approvals', page: 'Page 52' },
            { title: 'Section XI: History and Certain Corporate Matters', page: 'Page 56' },
            { title: 'Section XII: Our Management & Promoters', page: 'Page 60' },
            { title: 'Section XIII: Financial Information & MD&A', page: 'Page 66' },
            { title: 'Section XIV: Outstanding Litigation & Material Disputes', page: 'Page 78' },
            { title: 'Section XV: Other Disclosures & Declaration', page: 'Page 84' }
          ].map((item, idx) => (
            <div key={idx} className="p-2.5 bg-white border border-slate-100 hover:bg-slate-50 rounded-xl flex justify-between font-medium text-slate-800">
              <span>{item.title}</span>
              <span className="font-mono text-slate-500">{item.page}</span>
            </div>
          ))}

        </div>

      </div>

    </div>
  );
}
