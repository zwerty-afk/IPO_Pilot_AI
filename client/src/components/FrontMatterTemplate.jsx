import React from 'react';

/**
 * FrontMatterTemplate — Pages 1–3 of the SEBI DRHP
 *
 * Layout strictly follows template.md:
 *   Page 1 — DRHP Cover Page
 *   Page 2 — Issue Details & Statutory Allocation Structure
 *   Page 3 — Table of Contents
 *
 * All placeholders are filled from props; remaining blanks use [•] per SEBI convention.
 */
export default function FrontMatterTemplate({ company = {}, issueDetails = {}, intake = {}, stats = {} }) {
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
  const companyType = cd.company_type || 'Private Limited Company';
  const exchange = cd.proposed_exchange || issueDetails.exchange || 'NSE Emerge / BSE SME';
  const faceValue = cap.face_value || issueDetails.faceValue || '10';
  const freshIssueShares = cap.fresh_issue_shares || issueDetails.freshIssueShares || '[•]';
  const freshIssueAmt = obj.amount_to_raise || issueDetails.freshIssueAmt || '[•]';
  const ofsShares = cap.ofs_shares || issueDetails.ofsShares || 'N/A';
  const ofsAmt = cap.ofs_amount || issueDetails.ofsAmt || 'N/A';
  const totalOfferShares = issueDetails.totalOfferShares || '[•]';
  const totalOfferAmt = issueDetails.totalOfferAmt || '[•]';
  const brlm = od.brlm || issueDetails.brlm || 'GYR Capital Advisors Private Limited';
  const registrar = od.registrar || issueDetails.registrar || 'Bigshare Services Private Limited';
  const promoterSeller = prom.selling_shareholder || issueDetails.promoterSeller || '';
  const draftDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const anchorDate = issueDetails.anchorDate || '[•]';
  const offerOpenDate = issueDetails.offerOpenDate || '[•]';
  const offerCloseDate = issueDetails.offerCloseDate || '[•]';
  const floorPrice = issueDetails.floorPrice || '[•]';
  const capPrice = issueDetails.capPrice || '[•]';
  const minBidLot = issueDetails.minBidLot || '[•]';
  const designatedExchange = exchange.includes('/') ? exchange.split('/')[0].trim() : exchange;

  const PAGE_BREAK = (
    <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }} />
  );

  return (
    <div className="font-serif text-slate-900 leading-relaxed bg-white" style={{ fontFamily: 'Times New Roman, Times, serif' }}>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1 — DRHP COVER PAGE                                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-900 p-8 md:p-12 space-y-5 min-h-[1050px] shadow-md relative flex flex-col" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>

        {/* DRHP Title Banner */}
        <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
          <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">
            DRAFT RED HERRING PROSPECTUS
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            (This Draft Red Herring Prospectus will be updated upon filing with the RoC)
          </p>
          <div className="flex justify-center items-center gap-6 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-700"><strong>Dated:</strong> {draftDate}</span>
            <span className="text-[11px] font-bold text-slate-800">Please read Section 32 of the Companies Act, 2013</span>
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">100% Book Built Offer</span>
          </div>
        </div>

        {/* Company Name & Identity */}
        <div className="text-center space-y-2 border-b border-slate-300 pb-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-wide">
            {compName.toUpperCase()}
          </h2>
          <p className="text-[11px] text-slate-600 italic">
            (Originally incorporated as <em>"{formerName}"</em> under the Companies Act, {companyAct}; converted/renamed to{' '}
            <em>"{compName}"</em> on {incYear})
          </p>
          <div className="text-left max-w-xl mx-auto space-y-1 pt-2">
            <p className="text-[11px]"><strong>Corporate Identification Number (CIN):</strong> <span className="font-mono">{cin}</span></p>
            <p className="text-[11px]"><strong>Registered &amp; Corporate Office:</strong> {regOffice}</p>
            <p className="text-[11px]"><strong>Contact Person / Compliance Officer:</strong> {complianceOfficer}</p>
            <p className="text-[11px]"><strong>Telephone &amp; Email:</strong> {telephone} | {email}</p>
            <p className="text-[11px]"><strong>Website:</strong> {website}</p>
          </div>
        </div>

        {/* OUR PROMOTERS */}
        <div className="text-center border-b border-slate-300 pb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">OUR PROMOTERS</h3>
          <p className="text-sm font-black text-slate-900 mt-1">{promoters.toUpperCase()}</p>
        </div>

        {/* DETAILS OF THE OFFER TO THE PUBLIC */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">DETAILS OF THE OFFER TO THE PUBLIC</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">TYPE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">FRESH ISSUE SIZE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">OFFER FOR SALE SIZE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">TOTAL OFFER SIZE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">ELIGIBILITY AND SHARE RESERVATION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1.5 font-medium">Fresh Issue</td>
                  <td className="border border-slate-400 p-1.5">Up to <strong>{freshIssueShares}</strong> Equity Shares aggregating up to ₹<strong>{freshIssueAmt}</strong> Million</td>
                  <td className="border border-slate-400 p-1.5">
                    {ofsShares === 'N/A' ? 'Not Applicable' : `Up to ${ofsShares} Equity Shares aggregating up to ₹${ofsAmt} Million`}
                  </td>
                  <td className="border border-slate-400 p-1.5">Up to <strong>[•]</strong> Equity Shares aggregating up to ₹<strong>[•]</strong> Million</td>
                  <td className="border border-slate-400 p-1.5 text-[9px]">The Offer is being made pursuant to Regulation 6(1) of the SEBI (ICDR) Regulations, 2018, as amended. For further details, see "Other Regulatory and Statutory Disclosures".</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* DETAILS OF THE OFFER FOR SALE BY SELLING SHAREHOLDERS */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">DETAILS OF THE OFFER FOR SALE BY SELLING SHAREHOLDERS</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">NAME OF SELLING SHAREHOLDER</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">TYPE</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">NO. OF EQUITY SHARES OFFERED / AMOUNT (IN ₹ MILLION)</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">WEIGHTED AVERAGE COST OF ACQUISITION PER EQUITY SHARE (IN ₹)</th>
                </tr>
              </thead>
              <tbody>
                {promoterSeller ? (
                  <tr>
                    <td className="border border-slate-400 p-1.5 font-medium">{promoterSeller}</td>
                    <td className="border border-slate-400 p-1.5">Promoter Selling Shareholder</td>
                    <td className="border border-slate-400 p-1.5">Up to [•] Equity Shares aggregating up to ₹[•] Million</td>
                    <td className="border border-slate-400 p-1.5">Nil</td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="border border-slate-400 p-1.5 text-center text-slate-500 italic">Not Applicable — 100% Fresh Issue (No Offer for Sale)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] italic text-slate-600">*As certified by Statutory Auditors / Chartered Accountants pursuant to certificate dated {draftDate}.</p>
        </div>

        {/* STATUTORY & GENERAL RISK DISCLOSURES */}
        <div className="space-y-2 border-t border-slate-300 pt-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800">STATUTORY &amp; GENERAL RISK DISCLOSURES</h3>
          <ul className="space-y-1.5 list-none text-[10px] text-slate-800 leading-snug">
            <li>
              <strong>RISKS IN RELATION TO THE FIRST OFFER:</strong> This being the first public issue/offer of Equity Shares of our Company, there has been no formal market for the Equity Shares. The face value of each Equity Share is ₹{faceValue}. The Floor Price, Cap Price, and Offer Price as determined by our Company in consultation with the Book Running Lead Managers (BRLMs) in accordance with the SEBI ICDR Regulations should not be taken to be indicative of the market price after listing.
            </li>
            <li>
              <strong>GENERAL RISK:</strong> Investments in equity and equity-related securities involve a degree of risk. Bidders/Investors should not invest any funds in the Offer unless they can afford to take the risk of losing their entire investment. Investors are advised to read the risk factors carefully before taking an investment decision.
            </li>
            <li>
              <strong>ISSUER'S AND SELLING SHAREHOLDERS' ABSOLUTE RESPONSIBILITY:</strong> Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect. Each Selling Shareholder severally accepts responsibility for disclosures specifically pertaining to itself and its portion of Offered Shares.
            </li>
            <li>
              <strong>LISTING:</strong> The Equity Shares offered through the Red Herring Prospectus are proposed to be listed on the BSE Limited ("BSE") and the National Stock Exchange of India Limited ("NSE"). The Designated Stock Exchange shall be {designatedExchange}.
            </li>
          </ul>
        </div>

        {/* INTERMEDIARIES & BID/OFFER PROGRAMME */}
        <div className="space-y-2 border-t border-slate-300 pt-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800">INTERMEDIARIES &amp; BID/OFFER PROGRAMME</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase w-1/2">BOOK RUNNING LEAD MANAGERS (BRLMs)</th>
                  <th className="border border-slate-400 p-1.5 text-left font-bold uppercase w-1/2">REGISTRAR TO THE OFFER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1.5">
                    <p className="font-bold text-indigo-900">{brlm}</p>
                    <p className="text-slate-600 text-[9px]">Contact: Compliance Officer<br />Tel: [•] | Email: ipo@{brlm.toLowerCase().replace(/\s+/g,'')+'.com'}</p>
                  </td>
                  <td className="border border-slate-400 p-1.5">
                    <p className="font-bold text-indigo-900">{registrar}</p>
                    <p className="text-slate-600 text-[9px]">Contact: Investor Relations<br />Tel: [•] | Email: ipo@bigshareonline.com<br />SEBI Reg. No.: INR000001385</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-[10px] space-y-0.5 pt-1">
            <p><strong>BID/OFFER PROGRAMME</strong></p>
            <p><strong>ANCHOR INVESTOR BIDDING DATE:</strong> {anchorDate} <em>(1 Working Day prior to Bid/Offer Opening Date)</em></p>
            <p><strong>BID/OFFER OPENS ON:</strong> {offerOpenDate}</p>
            <p><strong>BID/OFFER CLOSES ON:</strong> {offerCloseDate} <em>(UPI Mandate end time: 5:00 PM on Bid/Offer Closing Date)</em></p>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2 — ISSUE DETAILS & STATUTORY ALLOCATION STRUCTURE        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-900 p-8 md:p-12 space-y-6 min-h-[1050px] shadow-md relative flex flex-col mt-8" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>

        {/* Page 2 Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
          <h2 className="text-xl font-black uppercase tracking-wide text-slate-900">{compName.toUpperCase()}</h2>
          <p className="text-[10px] text-slate-600 italic">
            (Registered &amp; Corporate Office: {regOffice}, Tel: {telephone}, Email: {email}, Website: {website}, CIN: {cin})
          </p>
        </div>

        {/* Full IPO Offer Sentence */}
        <div className="p-4 bg-slate-50 border border-slate-300 rounded">
          <p className="text-[11px] font-bold text-slate-900 leading-relaxed uppercase text-center">
            INITIAL PUBLIC OFFER OF UP TO [{freshIssueShares}] EQUITY SHARES OF FACE VALUE OF ₹{faceValue} EACH FOR CASH AT A PRICE OF ₹[•] PER EQUITY SHARE
            (INCLUDING A PREMIUM OF ₹[•] PER EQUITY SHARE) AGGREGATING UP TO ₹[•] MILLION COMPRISING A FRESH ISSUE OF UP TO [•] EQUITY SHARES AGGREGATING
            UP TO ₹[{freshIssueAmt}] MILLION {ofsShares !== 'N/A' ? `AND AN OFFER FOR SALE OF UP TO [•] EQUITY SHARES AGGREGATING UP TO ₹[${ofsAmt}] MILLION BY THE SELLING SHAREHOLDERS.` : '(100% FRESH ISSUE; NO OFFER FOR SALE).'}
          </p>
        </div>

        {/* PRICE BAND & BID LOT DETAILS */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">PRICE BAND &amp; BID LOT DETAILS</h3>
          <ul className="space-y-1.5 text-[11px] text-slate-800 list-none">
            <li><strong>FACE VALUE:</strong> ₹{faceValue} per Equity Share.</li>
            <li><strong>PRICE BAND:</strong> ₹{floorPrice} to ₹{capPrice} per Equity Share. The Cap Price shall be at least 105% of the Floor Price and less than or equal to 120% of the Floor Price.</li>
            <li><strong>MINIMUM BID LOT:</strong> {minBidLot} Equity Shares and in multiples of {minBidLot} Equity Shares thereafter.</li>
            <li><strong>DISSEMINATION:</strong> The Price Band, Employee Discount (if any), and Minimum Bid Lot will be advertised in an English national daily, a Hindi national daily, and a regional daily newspaper at least 2 Working Days prior to the Bid/Offer Opening Date.</li>
          </ul>
        </div>

        {/* OFFER STRUCTURE & ALLOCATION CATEGORIES */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-400 pb-1">OFFER STRUCTURE &amp; ALLOCATION CATEGORIES</h3>
          <p className="text-[10px] text-slate-700">
            The Offer is being made through the Book Building Process in compliance with Rule 19(2)(b) of the SCRR read with Regulation 31 &amp; 6(1) of the SEBI ICDR Regulations:
          </p>
          <ol className="space-y-2 text-[10px] text-slate-800 list-decimal list-inside leading-relaxed">
            <li>
              <strong>QUALIFIED INSTITUTIONAL BUYERS (QIB) PORTION:</strong> Not more than <strong>50%</strong> of the Net Offer shall be available for allocation to QIBs on a proportionate basis.
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li><strong>Anchor Investor Portion:</strong> Up to <strong>60%</strong> of the QIB Portion may be allocated to Anchor Investors on a discretionary basis, of which 33.33% is reserved for domestic Mutual Funds and 6.67% for Life Insurance Companies &amp; Pension Funds.</li>
                <li><strong>Mutual Fund Portion:</strong> <strong>5%</strong> of the Net QIB Portion shall be available for allocation to domestic Mutual Funds only.</li>
              </ul>
            </li>
            <li>
              <strong>NON-INSTITUTIONAL INVESTORS (NII) PORTION:</strong> Not less than <strong>15%</strong> of the Net Offer shall be available for allocation to NIIs:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li>One-third reserved for applicants with application size &gt; ₹200,000 up to ₹1,000,000.</li>
                <li>Two-thirds reserved for applicants with application size &gt; ₹1,000,000.</li>
              </ul>
            </li>
            <li>
              <strong>RETAIL INDIVIDUAL INVESTORS (RII) PORTION:</strong> Not less than <strong>35%</strong> of the Net Offer shall be available for allocation to Retail Individual Bidders in accordance with SEBI ICDR Regulations.
            </li>
            <li>
              <strong>MANDATORY ASBA &amp; UPI:</strong> All Bidders (except Anchor Investors) are mandatorily required to utilize the Application Supported by Blocked Amount (ASBA) process including UPI mechanism for UPI Bidders.
            </li>
          </ol>

          {/* Allocation Table */}
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[10px] border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-600 p-1.5 text-left font-bold uppercase">Investor Category</th>
                  <th className="border border-slate-600 p-1.5 text-left font-bold uppercase">Allocation %</th>
                  <th className="border border-slate-600 p-1.5 text-left font-bold uppercase">Indicative Shares</th>
                  <th className="border border-slate-600 p-1.5 text-left font-bold uppercase">Method</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-slate-400 p-1.5 font-bold">Qualified Institutional Buyers (QIB)</td><td className="border border-slate-400 p-1.5">Not more than 50.00% of Net Issue</td><td className="border border-slate-400 p-1.5 font-mono">[•] Equity Shares</td><td className="border border-slate-400 p-1.5">Proportionate</td></tr>
                <tr className="bg-slate-50"><td className="border border-slate-400 p-1.5 pl-5 italic text-slate-600">— Anchor Investor Portion</td><td className="border border-slate-400 p-1.5">Up to 60% of QIB Portion</td><td className="border border-slate-400 p-1.5 font-mono">[•]</td><td className="border border-slate-400 p-1.5">Discretionary</td></tr>
                <tr><td className="border border-slate-400 p-1.5 pl-5 italic text-slate-600">— Mutual Fund Portion</td><td className="border border-slate-400 p-1.5">5% of Net QIB</td><td className="border border-slate-400 p-1.5 font-mono">[•]</td><td className="border border-slate-400 p-1.5">Proportionate</td></tr>
                <tr className="bg-slate-50"><td className="border border-slate-400 p-1.5 font-bold">Non-Institutional Investors (NII)</td><td className="border border-slate-400 p-1.5">Not less than 15.00% of Net Issue</td><td className="border border-slate-400 p-1.5 font-mono">[•] Equity Shares</td><td className="border border-slate-400 p-1.5">Proportionate</td></tr>
                <tr><td className="border border-slate-400 p-1.5 font-bold">Retail Individual Investors (RII)</td><td className="border border-slate-400 p-1.5">Not less than 35.00% of Net Issue</td><td className="border border-slate-400 p-1.5 font-mono">[•] Equity Shares</td><td className="border border-slate-400 p-1.5">Proportionate by lots</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SEBI QR Code Notice */}
        <div className="text-center mt-auto pt-4 border-t border-slate-300">
          <p className="text-[9px] text-slate-600 italic">
            [SEBI 2026 COMPLIANCE] QR codes and web links directing to this DRHP are available on the front cover page, public announcements, and application forms in accordance with SEBI (ICDR) Amendment Regulations, 2026.
          </p>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3 — TABLE OF CONTENTS                                     */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="border-2 border-slate-900 p-8 md:p-12 space-y-4 min-h-[1050px] shadow-md relative flex flex-col mt-8">

        <div className="text-center border-b-2 border-slate-900 pb-3">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">TABLE OF CONTENTS</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5 text-left font-bold uppercase w-20">SECTION</th>
                <th className="border border-slate-400 p-1.5 text-left font-bold uppercase">SECTION TITLE</th>
                <th className="border border-slate-400 p-1.5 text-right font-bold uppercase w-20">PAGE NO.</th>
              </tr>
            </thead>
            <tbody>
              {/* Front Matter */}
              <tr className="bg-indigo-50">
                <td className="border border-slate-400 p-1.5 font-bold">—</td>
                <td className="border border-slate-400 p-1.5 font-bold">Front Matter — Cover Page, Issue Details &amp; Statutory Allocation</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">1–2</td>
              </tr>
              <tr className="bg-indigo-50">
                <td className="border border-slate-400 p-1.5 font-bold">—</td>
                <td className="border border-slate-400 p-1.5 font-bold">Table of Contents</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">3</td>
              </tr>

              {/* Section I */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION I</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">GENERAL</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">4</td>
              </tr>
              {[
                ['', 'Definitions and Abbreviations', '4'],
                ['', 'Certain Conventions, Presentation of Financial, Industry, and Market Data', '[•]'],
                ['', 'Forward-Looking Statements', '[•]'],
              ].map(([sec, title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]">{sec}</td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section II */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION II</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">RISK FACTORS</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>

              {/* Section III */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION III</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">INTRODUCTION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['The Offer', '[•]'],
                ['Summary of Restated Financial Information', '[•]'],
                ['Summary of Contingent Liabilities & Related Party Transactions', '[•]'],
                ['General Information', '[•]'],
                ['Capital Structure', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section IV */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION IV</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">PARTICULARS OF THE OFFER / OBJECTS</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['Objects of the Offer', '[•]'],
                ['Basis for Offer Price', '[•]'],
                ['Statement of Possible Special Tax Benefits', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section V */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION V</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">ABOUT OUR COMPANY</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['Industry Overview', '[•]'],
                ['Our Business', '[•]'],
                ['Key Regulations and Policies', '[•]'],
                ['History and Certain Corporate Matters', '[•]'],
                ['Our Management', '[•]'],
                ['Our Promoters and Promoter Group', '[•]'],
                ['Dividend Policy', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section VI */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION VI</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">FINANCIAL INFORMATION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['Restated Financial Statements', '[•]'],
                ["Management's Discussion and Analysis (MD&A)", '[•]'],
                ['Financial Indebtedness & Capitalisation Statement', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section VII */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION VII</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">LEGAL AND OTHER INFORMATION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['Outstanding Litigation and Material Developments', '[•]'],
                ['Government and Other Approvals', '[•]'],
                ['Group Companies', '[•]'],
                ['Other Regulatory and Statutory Disclosures', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Section VIII */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION VIII</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">OFFER INFORMATION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              {[
                ['Terms of the Offer & Offer Structure', '[•]'],
                ['Offer Procedure', '[•]'],
              ].map(([title, pg], i) => (
                <tr key={i}><td className="border border-slate-400 p-1 pl-4 font-mono text-[9px]"></td><td className="border border-slate-400 p-1 pl-6 text-[10px]">{title}</td><td className="border border-slate-400 p-1 text-right font-mono text-[9px]">{pg}</td></tr>
              ))}

              {/* Sections IX–XI */}
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION IX</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">DESCRIPTION OF EQUITY SHARES &amp; ARTICLES OF ASSOCIATION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION X</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">MATERIAL CONTRACTS AND DOCUMENTS FOR INSPECTION</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-400 p-1.5 font-bold">SECTION XI</td>
                <td className="border border-slate-400 p-1.5 font-bold uppercase">DECLARATIONS</td>
                <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">[•]</td>
              </tr>
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
