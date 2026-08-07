import React from 'react';
import { DRHP_HIERARCHY } from '../data/sebiDrhpSchema';

export function computePageNumbers(drafts = {}) {
  const pageNumbers = {};
  let currentPage = 4;

  DRHP_HIERARCHY.forEach((sec) => {
    pageNumbers[sec.id] = currentPage;
    if (sec.subsections && sec.subsections.length > 0) {
      sec.subsections.forEach((sub) => {
        pageNumbers[sub.id] = currentPage;
        const subKey = sub.key;
        const blocks = drafts[subKey]?.blocks || [];
        const estPages = Math.max(1, Math.ceil((blocks.length || 2) / 2));
        currentPage += estPages;
      });
    } else {
      const blocks = drafts[sec.key]?.blocks || [];
      const estPages = Math.max(1, Math.ceil((blocks.length || 2) / 2));
      currentPage += estPages;
    }
  });

  return pageNumbers;
}

export default function FrontMatterTemplate({ company = {}, issueDetails = {}, intake = {}, drafts = {}, onNavigateSection }) {
  // ── Resolve company data from all available sources ──────────────────────────
  const cd = intake?.company_details || {};
  const bo = intake?.business_overview || {};
  const cap = intake?.capital_structure || {};
  const obj = intake?.objects || {};
  const prom = intake?.promoters || {};
  const od = intake?.other_disclosures || {};

  const compName = cd.legal_name || company.name || company.legal_name || 'AARAV PRECISION ENGINEERING LIMITED';
  const formerName = cd.former_name || company.formerName || 'Aarav Precision Engineering Private Limited';
  const cin = cd.cin || company.cin || 'U29220MH2015PTC263456';
  const regOffice = cd.registered_office || company.address || 'Plot W-42, MIDC Industrial Area, Dombivli East, Thane - 421203, Maharashtra, India';
  const complianceOfficer = cd.compliance_officer || company.complianceOfficer || 'Rohan Sharma, Company Secretary & Compliance Officer';
  const telephone = cd.telephone || company.contactNo || '+91 251 287 4400';
  const email = cd.email || company.email || 'investors@aaravprecision.com';
  const website = cd.website || company.website || 'www.aaravprecision.com';
  const promoters = prom.promoters_list || company.promoters || 'Aarav Mehta & Sunita Mehta';
  const companyAct = cd.company_act || '2013';
  const incDate = cd.incorporation_date || company.incorporation_date || '2015';
  const incYear = incDate.substring(0, 4);
  const freshIssueShares = cap.fresh_issue_shares || issueDetails.freshIssueShares || '[•]';
  const freshIssueAmt = obj.amount_to_raise || issueDetails.freshIssueAmt || '[•]';
  const ofsShares = cap.ofs_shares || issueDetails.ofsShares || 'N/A';
  const ofsAmt = cap.ofs_amount || issueDetails.ofsAmt || 'N/A';
  const promoterSeller = prom.selling_shareholder || issueDetails.promoterSeller || '';
  const draftDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const anchorDate = issueDetails.anchorDate || '[•]';
  const offerOpenDate = issueDetails.offerOpenDate || '[•]';
  const offerCloseDate = issueDetails.offerCloseDate || '[•]';
  const floorPrice = issueDetails.floorPrice || '[•]';
  const capPrice = issueDetails.capPrice || '[•]';
  const minBidLot = issueDetails.minBidLot || '[•]';
  const brlm = od.brlm || issueDetails.brlm || 'GYR Capital Advisors Private Limited';
  const registrar = od.registrar || issueDetails.registrar || 'Bigshare Services Private Limited';
  const designatedExchange = issueDetails.exchange?.includes('/') ? issueDetails.exchange.split('/')[0].trim() : (issueDetails.exchange || 'NSE Emerge');

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const pageNumbersMap = computePageNumbers(drafts);

  const handleRowClick = (secKey, targetId) => {
    if (onNavigateSection) {
      onNavigateSection(secKey, targetId);
    }
    const elem = document.getElementById(targetId) || document.getElementById(`drhp-sec-${targetId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="font-serif text-slate-900 leading-relaxed bg-white" style={{ fontFamily: 'Times New Roman, Times, serif' }}>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — DRHP COVER PAGE                                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div id="draft_preview" className="border-2 border-slate-900 p-8 md:p-12 space-y-5 min-h-[1050px] shadow-md relative flex flex-col" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>

        <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
          <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">DRAFT RED HERRING PROSPECTUS</h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">(This Draft Red Herring Prospectus will be updated upon filing with the RoC)</p>
          <div className="flex justify-center items-center gap-6 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-700"><strong>Dated:</strong> {draftDate}</span>
            <span className="text-[11px] font-bold text-slate-800">Please read Section 32 of the Companies Act, 2013</span>
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">100% Book Built Offer</span>
          </div>
        </div>

        <div className="text-center space-y-2 border-b border-slate-300 pb-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-wide">{compName.toUpperCase()}</h2>
          <p className="text-[11px] text-slate-600 italic">
            (Originally incorporated as <em>"{formerName}"</em> under the Companies Act, {companyAct}; converted/renamed to <em>"{compName}"</em> on {incYear})
          </p>
          <div className="text-left max-w-xl mx-auto space-y-1 pt-2 text-[11px]">
            <p><strong>CIN:</strong> <span className="font-mono">{cin}</span></p>
            <p><strong>Registered &amp; Corporate Office:</strong> {regOffice}</p>
            <p><strong>Contact:</strong> {complianceOfficer} | {telephone} | {email} | {website}</p>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">DETAILS OF THE OFFER FOR SALE BY SELLING SHAREHOLDERS</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">NAME OF SELLING SHAREHOLDER</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">TYPE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">NO. OF SHARES / AMOUNT</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">WAC OF ACQUISITION</th>
                </tr>
              </thead>
              <tbody>
                {promoterSeller ? (
                  <tr>
                    <td className="border border-slate-400 p-1.5 font-bold">{promoterSeller}</td>
                    <td className="border border-slate-400 p-1.5">Promoter Selling Shareholder</td>
                    <td className="border border-slate-400 p-1.5 font-mono">Up to {ofsShares} Shares (₹{ofsAmt} Mn)</td>
                    <td className="border border-slate-400 p-1.5 font-mono">[•]</td>
                  </tr>
                ) : (
                  <tr>
                    <td className="border border-slate-400 p-1.5 italic text-slate-500" colSpan={4}>
                      NIL — 100% Fresh Issue (No Promoters selling shares under Offer For Sale).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-1 text-[9px] text-slate-800 leading-normal border-t border-slate-300 pt-2">
          <p><strong>RISKS IN RELATION TO THE FIRST OFFER:</strong> This being the first public issue of Equity Shares of our Company, there has been no formal market for the Equity Shares. The face value is ₹10 per share. The Floor Price, Cap Price, and Offer Price determined by our Company in consultation with BRLM should not be taken as indicative of the market price after listing.</p>
          <p><strong>GENERAL RISK:</strong> Investments in equity and equity-related securities involve a degree of risk. Investors should not invest funds they cannot afford to lose. Investors are advised to read the Risk Factors carefully before taking an investment decision.</p>
          <p><strong>ISSUER'S ABSOLUTE RESPONSIBILITY:</strong> Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect.</p>
        </div>

        <div className="space-y-1 border-t border-slate-300 pt-2">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><strong>Book Running Lead Manager (BRLM):</strong> {brlm}</div>
            <div><strong>Registrar to the Offer:</strong> {registrar}</div>
          </div>
          <div className="bg-slate-100 p-1.5 text-center text-[10px] font-bold border border-slate-300 mt-1">
            BID/OFFER OPENS ON: {offerOpenDate} &nbsp;|&nbsp; BID/OFFER CLOSES ON: {offerCloseDate} &nbsp;|&nbsp; ANCHOR INVESTOR BIDDING DATE: {anchorDate}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — ISSUE DETAILS & STATUTORY ALLOCATION STRUCTURE         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-900 p-8 md:p-12 space-y-4 min-h-[1050px] shadow-md relative flex flex-col mt-8" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
        <div className="text-center border-b-2 border-slate-900 pb-3">
          <h2 className="text-lg font-black uppercase text-slate-900">{compName.toUpperCase()}</h2>
          <p className="text-[10px] font-mono text-slate-500">CIN: {cin} | Registered Office: {regOffice}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">FORMAL OFFER NOTICE</h3>
          <p className="text-[10px] font-bold leading-relaxed text-justify text-slate-900">
            INITIAL PUBLIC OFFER OF UP TO [•] EQUITY SHARES OF FACE VALUE OF ₹10 EACH FOR CASH AT A PRICE OF ₹[•] PER EQUITY SHARE (INCLUDING A PREMIUM OF ₹[•] PER EQUITY SHARE) AGGREGATING UP TO ₹{freshIssueAmt} MILLION ("OFFER"). THE OFFER CONSTITUTES 100% FRESH ISSUE; NO SHARES ARE OFFERED UNDER OFFER FOR SALE (OFS).
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">PRICE BAND &amp; BID LOT PARAMETERS</h3>
          <ul className="space-y-1 text-[10px] text-slate-800 list-disc list-inside leading-normal">
            <li><strong>FACE VALUE:</strong> ₹10 per Equity Share.</li>
            <li><strong>PRICE BAND:</strong> ₹{floorPrice} to ₹{capPrice} per Equity Share. The Cap Price shall be at least 105% and at most 120% of the Floor Price.</li>
            <li><strong>MINIMUM BID LOT:</strong> {minBidLot} Equity Shares and in multiples of {minBidLot} Equity Shares thereafter.</li>
            <li><strong>DISSEMINATION:</strong> The Price Band, Employee Discount (if any), and Minimum Bid Lot will be advertised in an English national daily, a Hindi national daily, and a regional daily newspaper at least 2 Working Days prior to the Bid/Offer Opening Date.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">OFFER STRUCTURE &amp; ALLOCATION CATEGORIES</h3>
          <p className="text-[10px] text-slate-700">
            The Offer is being made through the Book Building Process in compliance with Rule 19(2)(b) of the SCRR read with Regulation 31 &amp; 6(1) of the SEBI ICDR Regulations:
          </p>
          <ol className="space-y-2 text-[10px] text-slate-800 list-decimal list-inside leading-relaxed">
            <li>
              <strong>QUALIFIED INSTITUTIONAL BUYERS (QIB) PORTION:</strong> Not more than <strong>50%</strong> of the Net Offer shall be available for allocation to QIBs on a proportionate basis.
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li><strong>Anchor Investor Portion:</strong> Up to <strong>60%</strong> of the QIB Portion may be allocated to Anchor Investors on a discretionary basis.</li>
                <li><strong>Mutual Fund Portion:</strong> <strong>5%</strong> of the Net QIB Portion shall be available for allocation to domestic Mutual Funds only.</li>
              </ul>
            </li>
            <li>
              <strong>NON-INSTITUTIONAL INVESTORS (NII) PORTION:</strong> Not less than <strong>15%</strong> of the Net Offer shall be available for allocation to NIIs.
            </li>
            <li>
              <strong>RETAIL INDIVIDUAL INVESTORS (RII) PORTION:</strong> Not less than <strong>35%</strong> of the Net Offer shall be available for allocation to Retail Individual Bidders.
            </li>
            <li>
              <strong>MANDATORY ASBA &amp; UPI:</strong> All Bidders (except Anchor Investors) are mandatorily required to utilize the Application Supported by Blocked Amount (ASBA) process including UPI mechanism.
            </li>
          </ol>
        </div>

        <div className="text-center mt-auto pt-4 border-t border-slate-300">
          <p className="text-[9px] text-slate-600 italic">
            [SEBI 2026 COMPLIANCE] Quick response (QR) codes and direct web links directing to this DRHP are available on the front cover page, public announcements, and application forms in accordance with SEBI (ICDR) Amendment Regulations, 2026.
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3 — COMPLETE CLICKABLE & DYNAMIC TABLE OF CONTENTS          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-900 p-8 md:p-12 space-y-4 min-h-[1050px] shadow-md relative flex flex-col mt-8" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>

        <div className="text-center border-b-2 border-slate-900 pb-3">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">TABLE OF CONTENTS</h2>
          <p className="text-[10px] font-mono text-indigo-700 mt-1 uppercase font-bold">
            Interactive Navigation Page — Click any Section or Subsection to Navigate
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-600 p-2 text-left font-bold uppercase w-24">SECTION</th>
                <th className="border border-slate-600 p-2 text-left font-bold uppercase">MAIN SECTION &amp; SUBSECTION TITLE</th>
                <th className="border border-slate-600 p-2 text-right font-bold uppercase w-20">PAGE NO.</th>
              </tr>
            </thead>
            <tbody>
              {/* Front Matter entries */}
              <tr 
                onClick={() => handleRowClick('cover_pages', 'draft_preview')}
                className="bg-indigo-50/80 hover:bg-indigo-100 cursor-pointer transition-colors"
              >
                <td className="border border-slate-400 p-1.5 font-bold font-mono text-indigo-900">—</td>
                <td className="border border-slate-400 p-1.5 font-bold text-indigo-950">Cover Page (Issuer Branding, CIN &amp; Statutory Risk Warnings)</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-indigo-900">1</td>
              </tr>
              <tr 
                onClick={() => handleRowClick('cover_pages', 'draft_preview')}
                className="bg-indigo-50/80 hover:bg-indigo-100 cursor-pointer transition-colors"
              >
                <td className="border border-slate-400 p-1.5 font-bold font-mono text-indigo-900">—</td>
                <td className="border border-slate-400 p-1.5 font-bold text-indigo-950">Issue Details &amp; Statutory Allocation Structure</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-indigo-900">2</td>
              </tr>
              <tr 
                onClick={() => handleRowClick('cover_pages', 'draft_preview')}
                className="bg-indigo-50/80 hover:bg-indigo-100 cursor-pointer transition-colors"
              >
                <td className="border border-slate-400 p-1.5 font-bold font-mono text-indigo-900">—</td>
                <td className="border border-slate-400 p-1.5 font-bold text-indigo-950">Table of Contents</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-indigo-900">3</td>
              </tr>

              {/* Dynamic SEBI Hierarchy Main Sections and Subsections */}
              {DRHP_HIERARCHY.map((sec, secIdx) => {
                const romanNum = `SECTION ${romanNumerals[secIdx] || (secIdx + 1)}`;
                const secPage = pageNumbersMap[sec.id] || (4 + secIdx * 10);
                const hasSub = sec.subsections && sec.subsections.length > 0;

                return (
                  <React.Fragment key={sec.id}>
                    {/* Main Section Header Row */}
                    <tr 
                      onClick={() => handleRowClick(sec.key, sec.id)}
                      className="bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors border-t-2 border-slate-400"
                    >
                      <td className="border border-slate-400 p-1.5 font-black text-slate-900 font-mono">{romanNum}</td>
                      <td className="border border-slate-400 p-1.5 font-black uppercase text-slate-900">{sec.title}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-black text-slate-900">{secPage}</td>
                    </tr>

                    {/* Subsections Rows */}
                    {hasSub && sec.subsections.map((sub, subIdx) => {
                      const subNum = `${secIdx + 1}.${subIdx + 1}`;
                      const subPage = pageNumbersMap[sub.id] || secPage;

                      return (
                        <tr 
                          key={sub.id}
                          onClick={() => handleRowClick(sub.key, sub.id)}
                          className="hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                        >
                          <td className="border border-slate-400 p-1 pl-4 font-mono text-[9px] text-slate-500">{subNum}</td>
                          <td className="border border-slate-400 p-1 pl-6 text-[10px] text-slate-800 group-hover:text-indigo-900 group-hover:font-semibold">
                            {sub.title}
                          </td>
                          <td className="border border-slate-400 p-1 text-right font-mono text-[9px] text-slate-600 font-semibold">{subPage}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-300 text-center">
          <p className="text-[9px] text-slate-500 italic">
            Generated by IPO Pilot AI — {draftDate} — This Draft Red Herring Prospectus is subject to review by SEBI-registered Merchant Banker and Legal Counsel before filing.
          </p>
        </div>
      </div>

    </div>
  );
}
