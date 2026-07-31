import { useState, useEffect } from 'react';
import { getIntakeStep, saveIntakeStep } from '../services/api';
import { 
  Building, 
  Briefcase, 
  Users, 
  Target, 
  PieChart, 
  HelpCircle, 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Check, 
  Loader2,
  AlertCircle
} from 'lucide-react';

const steps = [
  { key: 'company_details', label: 'Company Details', icon: Building },
  { key: 'business_overview', label: 'Business Overview', icon: Briefcase },
  { key: 'promoters', label: 'Promoters & Directors', icon: Users },
  { key: 'objects', label: 'Objects of the Issue', icon: Target },
  { key: 'capital_structure', label: 'Capital Structure', icon: PieChart },
  { key: 'rpt', label: 'Related Party Transactions', icon: Users },
  { key: 'financials', label: 'Financials Summary', icon: PieChart },
  { key: 'litigation', label: 'Litigation & Disputes', icon: AlertCircle }
];

const stepQuestions = {
  company_details: [
    { name: 'legal_name', label: 'Company Legal Name', type: 'text', placeholder: 'e.g., Aarav Precision Engineering Pvt Ltd', why: 'Must match incorporation certificate exactly.', example: 'Aarav Precision Engineering Pvt Ltd' },
    { name: 'cin', label: 'Corporate Identification Number (CIN)', type: 'text', placeholder: '21-digit alphanumeric CIN', why: 'Identifies corporate registration with MCA.', example: 'U29220MH2015PTC263456' },
    { name: 'incorporation_date', label: 'Date of Incorporation', type: 'date', why: 'Establishes track record requirements (usually 3 years).', example: '2015-04-12' },
    { name: 'registered_office', label: 'Registered Office Address', type: 'textarea', placeholder: 'Full address', why: 'Determines jurisdictional courts and state regulatory bounds.', example: 'W-45, MIDC Industrial Area, Dombivli East, Thane, Maharashtra - 421204' },
    { name: 'industry_type', label: 'Industry Sector', type: 'text', placeholder: 'e.g., Heavy Industry, Fintech', why: 'Directs the sector classification on stock exchange boards.', example: 'Precision Engineering & Manufacturing' }
  ],
  business_overview: [
    { name: 'industry_desc', label: 'Sector Analysis Summary', type: 'textarea', placeholder: 'Provide industry trends...', why: 'Assists risk assessors in analyzing growth factors.', example: 'The precision engineering industry in India serves aerospace, automotive, and defense, requiring strict compliance to ISO and metrology rules.' },
    { name: 'products', label: 'Key Products & Services', type: 'textarea', placeholder: 'What does your company manufacture/sell?', why: 'Defines business operations for potential investors.', example: 'High-precision CNC machined components, brass fittings, specialized fasteners, and custom assemblies.' },
    { name: 'customers', label: 'Major Clients', type: 'text', placeholder: 'Client names separated by commas', why: 'Demonstrates market traction and customer risk/concentration.', example: 'Bharat Hydraulic Systems, Sterling Auto Components, Royal Aerospace Parts India' },
    { name: 'operations', label: 'Infrastructure & Operational Description', type: 'textarea', placeholder: 'Manufacturing setup details...', why: 'Documents facility capacity and assets.', example: 'Operating from a 15,000 sq ft facility in Dombivli, Maharashtra, equipped with 14 CNC turning centers, 6 vertical machining centers (VMC), and a dedicated metrology lab.' }
  ],
  promoters: [
    { name: 'promoters_list', label: 'Promoter Profiles & Experience', type: 'textarea', placeholder: 'Name, qualification, experience...', why: 'SEBI mandates detailing key management capability.', example: 'Aarav Mehta (Managing Director, 18 years experience in tool manufacturing) and Rohan Mehta (Director of Operations, 15 years experience in precision machining).' },
    { name: 'directors', label: 'Board of Directors composition', type: 'textarea', placeholder: 'Full names of all directors...', why: 'Identifies board structure and independent governance.', example: 'Aarav Mehta, Rohan Mehta, and Mrs. Sunita Mehta (Non-Executive Director).' }
  ],
  objects: [
    { name: 'amount_to_raise', label: 'Proposed Amount to Raise (INR)', type: 'number', placeholder: 'e.g., 50000000', why: 'Sets total capital size of the public issue.', example: '50000000' },
    { name: 'purpose', label: 'Utilization of Net Proceeds', type: 'textarea', placeholder: 'Acquisition of machines, debt repayment...', why: 'Investors must know exactly what their money funding.', example: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.' },
    { name: 'timeline', label: 'Deployment Timeline (SEBI Mandatory)', type: 'textarea', placeholder: 'e.g. FY27: 3 Cr, FY28: 2 Cr...', why: 'Crucial timeline field. Leaving this blank flags a Red disclosure gap on the dashboard!', example: 'FY27: 35,000,000 INR for VMC purchases; FY28: 15,000,000 INR for working capital requirements.' }
  ],
  capital_structure: [
    { name: 'total_shares', label: 'Total Pre-IPO Shares', type: 'number', placeholder: 'e.g. 1000000', why: 'Establishes capitalization denominator.', example: '1000000' },
    { name: 'promoter_holding_pct', label: 'Promoter Shareholding Percentage (%)', type: 'number', placeholder: 'e.g. 65', why: 'Discrepancy test: Stating 65% here while Cap Table document registers 62% will trigger a consistency alert.', example: '62' },
    { name: 'shareholders', label: 'Key Shareholding Pattern Details', type: 'textarea', placeholder: 'Major shareholders list...', why: 'Identifies control blocks.', example: 'Aarav Mehta: 620,000 shares (62%), Rohan Mehta: 350,000 shares (35%), Other minority: 30,000 shares (3%).' }
  ],
  rpt: [
    { name: 'has_rpt', label: 'Any Related Party Transactions?', type: 'select', options: [{value: 'no', label: 'No'}, {value: 'yes', label: 'Yes'}], why: 'Conflict checks are heavily scrutinized by regulators.', example: 'yes' },
    { name: 'rpt_details', label: 'Describe Related Party Transactions', type: 'textarea', placeholder: 'Rent details, loans, supply arrangements...', why: 'Only required if related transactions are active.', example: 'The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm\'s length basis verified by local valuer report.' }
  ],
  financials: [
    { name: 'revenue_fy25', label: 'FY25 Revenue (INR)', type: 'number', placeholder: 'e.g. 125000000', why: 'Discrepancy test: Stating 125,000,000 (12.5 Cr) while Audited Financials shows 11.8 Cr will trigger an alert.', example: '118000000' },
    { name: 'revenue_fy24', label: 'FY24 Revenue (INR)', type: 'number', placeholder: 'e.g. 95000000', why: 'Demonstrates revenue trajectory.', example: '95000000' },
    { name: 'revenue_fy23', label: 'FY23 Revenue (INR)', type: 'number', placeholder: 'e.g. 72000000', why: 'Establishes three year growth record.', example: '72000000' },
    { name: 'profit_fy25', label: 'FY25 Profit After Tax (INR)', type: 'number', placeholder: 'e.g. 11000000', why: 'Proves profit track record required for Emerge boards.', example: '11000000' },
    { name: 'total_debt', label: 'Total Outstanding Borrowings (INR)', type: 'number', placeholder: 'e.g. 25000000', why: 'Used to measure capital leverage ratio.', example: '25000000' }
  ],
  litigation: [
    { name: 'has_litigation', label: 'Are there pending litigations against Promoter/Company?', type: 'select', options: [{value: 'no', label: 'No'}, {value: 'yes', label: 'Yes'}], why: 'Material litigations must be fully declared.', example: 'yes' },
    { name: 'litigation_details', label: 'Details of Pending Litigations & Demands', type: 'textarea', placeholder: 'Case references, forums, amounts...', why: 'Direct impact on litigation risks chapter.', example: 'An income tax appeal is pending before the Commissioner of Income Tax (Appeals), Mumbai, regarding disallowance of depreciation on tools for FY22, involving a tax demand of 1,200,000 INR. The company has deposited 20% of the demand as per standard stay conditions.' }
  ]
};

export default function IntakeForm() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeWhy, setActiveWhy] = useState(null);
  
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';
  const currentStep = steps[currentStepIndex];

  // Fetch data for the current step
  const loadStepData = async () => {
    try {
      setLoading(true);
      const res = await getIntakeStep(companyId, currentStep.key);
      setFormData(res.data || res || {});
      setActiveWhy(null);
      setSavedSuccess(false);
    } catch (err) {
      console.error('Failed to load step data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStepData();
  }, [currentStepIndex, companyId]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (advance = false) => {
    try {
      setSaving(true);
      setSavedSuccess(false);
      await saveIntakeStep(companyId, currentStep.key, formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      
      if (advance && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to save step:', err);
    } finally {
      setSaving(false);
    }
  };

  const fillExample = (name, exampleVal) => {
    handleInputChange(name, exampleVal);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
      
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-2">
        <h3 className="font-bold text-slate-800 text-sm px-3 mb-4 uppercase tracking-wider">Intake Sections</h3>
        <div className="space-y-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStepIndex;
            return (
              <button
                key={step.key}
                onClick={() => setCurrentStepIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Questionnaire Body */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Step {currentStepIndex + 1} of {steps.length}</span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{currentStep.label}</h2>
            </div>
            {savedSuccess && (
              <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold animate-pulse">
                <Check className="w-4 h-4" /> Progress Saved
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {stepQuestions[currentStep.key].map((q) => (
                <div key={q.name} className="space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{q.label}</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fillExample(q.name, q.example)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 transition-colors font-medium border border-indigo-200/50 hover:border-indigo-400 px-2 py-0.5 rounded bg-indigo-50/20"
                      >
                        Auto-Fill Sample
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveWhy(activeWhy === q.name ? null : q.name)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Why this matters"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {activeWhy === q.name && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-normal animate-slide-up">
                      <strong>Why this is required:</strong> {q.why}
                    </div>
                  )}

                  {q.type === 'textarea' ? (
                    <textarea
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      placeholder={q.placeholder}
                      className="input-field min-h-24 py-2 resize-none"
                    />
                  ) : q.type === 'select' ? (
                    <select
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      className="input-field appearance-none bg-no-repeat bg-right pr-10"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
                    >
                      <option value="">Select option...</option>
                      {q.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={q.type}
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      placeholder={q.placeholder}
                      className="input-field"
                    />
                  )}
                </div>
              ))}

              {/* Navigation Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-8">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-all font-semibold text-xs uppercase"
                >
                  <ArrowLeft className="w-4 h-4" /> Prev Step
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl transition-all text-xs font-bold uppercase"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="btn-primary flex items-center gap-1.5 text-xs font-bold uppercase shadow-indigo-600/10"
                  >
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>

    </div>
  );
}
