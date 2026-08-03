import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getIntakeStep,
  saveIntakeStep,
  getIntake,
  getDocuments,
  getPrefillSuggestions,
  applyPrefill
} from '../services/api';
import { steps, stepQuestions, checkFieldAgainstDocuments } from '../data/intakeSchema';
import {
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  Loader2,
  AlertCircle,
  FileSearch,
  Sparkles
} from 'lucide-react';

// steps + stepQuestions now live in ../data/intakeSchema (shared with Dashboard).

export default function IntakeForm() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeWhy, setActiveWhy] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [allIntake, setAllIntake] = useState({});
  const [documents, setDocuments] = useState([]);
  const [dismissedMismatches, setDismissedMismatches] = useState({});
  const [prefill, setPrefill] = useState([]);
  const [prefillApplying, setPrefillApplying] = useState(false);
  const [prefillDismissed, setPrefillDismissed] = useState(false);
  const [prefillNote, setPrefillNote] = useState('');

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
      setErrors({});
      setTouched({});
      setDismissedMismatches({});
      setPrefillDismissed(false);
    } catch (err) {
      console.error('Failed to load step data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStepData();
  }, [currentStepIndex, companyId]);

  // Whole-intake snapshot drives the per-module completion ticks in the sidebar.
  const loadAllIntake = useCallback(async () => {
    try {
      const res = await getIntake(companyId);
      setAllIntake(res.data || res || {});
    } catch (err) {
      console.error('Failed to load intake overview:', err);
    }
  }, [companyId]);

  useEffect(() => { loadAllIntake(); }, [loadAllIntake, savedSuccess]);

  // Uploaded documents back the real-time cross-document validation below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDocuments(companyId);
        if (!cancelled) setDocuments(res.data || res || []);
      } catch (err) {
        console.error('Failed to load documents for validation:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Values the OCR scan pulled out of uploaded documents, ready to drop into the form.
  const loadPrefill = useCallback(async () => {
    try {
      const res = await getPrefillSuggestions(companyId);
      const payload = res.data || res || {};
      setPrefill(payload.suggestions || []);
    } catch (err) {
      // A missing prefill endpoint must never block the questionnaire itself.
      console.error('Failed to load prefill suggestions:', err);
      setPrefill([]);
    }
  }, [companyId]);

  useEffect(() => { loadPrefill(); }, [loadPrefill]);

  // Only offer suggestions for the step on screen, and only for fields this step
  // actually renders. The document map extracts more keys than the questionnaire
  // asks for (net_worth, total_assets, ...); offering those would ask the promoter
  // to approve a change to a field they cannot see, labelled with a raw key name.
  const stepPrefill = prefill.filter(
    (s) => s.step === currentStep.key &&
      (stepQuestions[currentStep.key] || []).some((q) => q.name === s.field)
  );
  const blanksHere = stepPrefill.filter((s) => !s.conflict);

  // Fills every empty field on this step from the documents. Conflicts are left
  // alone: an answer the promoter already gave is theirs to change, via the
  // per-field mismatch card below.
  const handleApplyPrefill = async () => {
    try {
      setPrefillApplying(true);
      const res = await applyPrefill(companyId, {
        fields: blanksHere.map((s) => `${s.step}.${s.field}`)
      });
      const payload = res.data || res || {};
      setPrefillNote(payload.message || 'Filled from your documents.');
      await loadStepData();
      await loadPrefill();
      await loadAllIntake();
      setTimeout(() => setPrefillNote(''), 4000);
    } catch (err) {
      console.error('Failed to apply prefill:', err);
      setPrefillNote('Could not auto-fill right now. Please enter the values manually.');
      setTimeout(() => setPrefillNote(''), 4000);
    } finally {
      setPrefillApplying(false);
    }
  };

  // Compares a live field value against the matching OCR-extracted document value.
  const mismatchFor = (q) => {
    if (dismissedMismatches[q.name]) return null;
    return checkFieldAgainstDocuments(currentStep.key, q.name, formData[q.name], documents);
  };

  // A module counts as done when every non-conditional field carries a value.
  const moduleStatus = (stepKey) => {
    const data = stepKey === currentStep.key ? formData : (allIntake[stepKey] || {});
    const qs = stepQuestions[stepKey] || [];
    const req = qs.filter((q) => !q.optional && (!q.dependsOn || data[q.dependsOn] === 'yes'));
    if (!req.length) return 'complete';
    const filled = req.filter((q) => String(data[q.name] ?? '').trim() !== '').length;
    if (filled === 0) return 'empty';
    return filled === req.length ? 'complete' : 'partial';
  };

  // ── Inline validation ──────────────────────────────────────────────────────
  const validateField = (q, value) => {
    const val = String(value ?? '').trim();
    if (q.optional) return '';
    if (!val) return `${q.label} is required.`;

    if (q.name === 'cin' && !/^[A-Za-z0-9]{21}$/.test(val)) {
      return 'CIN must be exactly 21 alphanumeric characters.';
    }
    if (q.type === 'number') {
      if (Number.isNaN(Number(val))) return 'Please enter a valid number.';
      if (Number(val) < 0) return 'Value cannot be negative.';
      if (q.name === 'promoter_holding_pct' && (Number(val) > 100 || Number(val) <= 0)) {
        return 'Shareholding must be between 0 and 100 percent.';
      }
    }
    if (q.type === 'date' && val) {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return 'Please enter a valid date.';
      if (d > new Date()) return 'Date cannot be in the future.';
    }
    return '';
  };

  const questions = stepQuestions[currentStep.key] || [];

  const validateStep = () => {
    const nextErrors = {};
    questions.forEach((q) => {
      // "Details" fields only matter when the paired yes/no answer is "yes".
      if (q.dependsOn && formData[q.dependsOn] !== 'yes') return;
      const msg = validateField(q, formData[q.name]);
      if (msg) nextErrors[q.name] = msg;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Progress across the whole intake step (share of required fields completed).
  const requiredQs = questions.filter((q) => !q.optional && (!q.dependsOn || formData[q.dependsOn] === 'yes'));
  const completedCount = requiredQs.filter((q) => String(formData[q.name] ?? '').trim() !== '').length;
  const stepProgress = requiredQs.length ? Math.round((completedCount / requiredQs.length) * 100) : 100;

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const q = questions.find((f) => f.name === name);
    if (q && touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(q, value) }));
    }
  };

  const handleBlur = (q) => {
    setTouched((prev) => ({ ...prev, [q.name]: true }));
    if (q.dependsOn && formData[q.dependsOn] !== 'yes') return;
    setErrors((prev) => ({ ...prev, [q.name]: validateField(q, formData[q.name]) }));
    // Persist as the promoter moves off the field, so the readiness score credits
    // it right away rather than only when the section is submitted. Silent by
    // design: "Save Progress" and "Next Step" still drive the visible confirmation,
    // and a failure here is not worth interrupting typing over — the explicit
    // save will surface it.
    autoSaveField(q);
  };

  // Fire-and-forget per-field save. Skipped when the value has not changed since
  // the last load or save, so tabbing through a filled form makes no requests.
  const savedValuesRef = useRef({});
  useEffect(() => { savedValuesRef.current = { ...formData }; }, [currentStepIndex]);

  const autoSaveField = async (q) => {
    const value = formData[q.name];
    if (String(savedValuesRef.current[q.name] ?? '') === String(value ?? '')) return;
    if (String(value ?? '').trim() === '') return;      // nothing to credit yet
    if (validateField(q, value)) return;                 // don't persist invalid input
    savedValuesRef.current = { ...savedValuesRef.current, [q.name]: value };
    try {
      await saveIntakeStep(companyId, currentStep.key, { ...formData, [q.name]: value });
      loadAllIntake();
    } catch (err) {
      // Roll back the guard so the next blur (or explicit save) retries.
      delete savedValuesRef.current[q.name];
      console.error('Auto-save on blur failed:', err);
    }
  };

  const handleSave = async (advance = false) => {
    // Advancing requires a valid step; plain "Save Progress" always works so
    // promoters can stop half-way and resume later.
    if (advance) {
      const allTouched = {};
      questions.forEach((q) => { allTouched[q.name] = true; });
      setTouched(allTouched);
      if (!validateStep()) return;
    }
    try {
      setSaving(true);
      setSavedSuccess(false);
      await saveIntakeStep(companyId, currentStep.key, formData);
      // Keep the blur-autosave guard aligned with what is now persisted, so an
      // explicit save doesn't leave stale entries that suppress later autosaves.
      savedValuesRef.current = { ...formData };
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

  // Fills every field in the section on screen with its sample value, in one
  // action. This replaced a per-field "Auto-Fill Sample" button on every row —
  // same sample data, same validation, just one trigger per section instead of
  // one per field. Conditional fields whose parent answer is not "yes" are
  // skipped so the form does not populate rows the promoter cannot see.
  const fillSectionExamples = () => {
    const next = { ...formData };
    // Parents first, so a dependent field sees the sample value its parent just got.
    questions.filter((q) => !q.dependsOn).forEach((q) => {
      if (q.example !== undefined) next[q.name] = q.example;
    });
    questions.filter((q) => q.dependsOn).forEach((q) => {
      // A dependent field only applies once its parent answer is "yes".
      if (q.example !== undefined && next[q.dependsOn] === 'yes') next[q.name] = q.example;
    });
    setFormData(next);
    // Re-validate anything already touched so error text tracks the new values.
    setErrors((prev) => {
      const updated = { ...prev };
      questions.forEach((q) => {
        if (touched[q.name]) updated[q.name] = validateField(q, next[q.name]);
      });
      return updated;
    });
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
            const status = moduleStatus(step.key);
            return (
              <button
                key={step.key}
                onClick={() => setCurrentStepIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{step.label}</span>
                {status === 'complete' ? (
                  <Check className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-500'}`} title="Module complete" />
                ) : status === 'partial' ? (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white/70' : 'bg-amber-400'}`} title="In progress" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Questionnaire Body */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Step {currentStepIndex + 1} of {steps.length}</span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{currentStep.label}</h2>
              </div>
              <div className="flex items-center gap-3">
                {savedSuccess && (
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold animate-pulse">
                    <Check className="w-4 h-4" /> Progress Saved
                  </span>
                )}
                {/* One trigger for the whole section, replacing the per-field
                    "Auto-Fill Sample" buttons that used to sit on every row. */}
                <button
                  type="button"
                  onClick={fillSectionExamples}
                  disabled={loading}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors font-medium border border-indigo-200/50 hover:border-indigo-400 px-2 py-0.5 rounded bg-indigo-50/20"
                >
                  Auto-Fill Section
                </button>
              </div>
            </div>

            {/* Section progress indicator */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section Progress</span>
                <span className={`text-[10px] font-bold ${stepProgress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {completedCount} of {requiredQs.length} required · {stepProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stepProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Auto-fill from scanned documents ──────────────────────────────
              Values OCR read out of the uploaded files. Blanks can be filled in
              one click; conflicts stay with the per-field card so the promoter
              always sees both numbers before overwriting their own answer. */}
          {!loading && !prefillDismissed && stepPrefill.length > 0 && (
            <div className="mb-6 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-slide-up">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-900 leading-tight">
                      We read {stepPrefill.length} value{stepPrefill.length === 1 ? '' : 's'} for this section from your documents
                    </p>
                    <p className="text-[11px] text-indigo-800/80 mt-0.5">
                      {blanksHere.length > 0
                        ? `${blanksHere.length} empty field${blanksHere.length === 1 ? '' : 's'} can be filled automatically.`
                        : 'Every value here differs from what you entered — review each one below.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefillDismissed(true)}
                  className="text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 underline decoration-indigo-300 shrink-0"
                >
                  Not now
                </button>
              </div>

              <div className="space-y-1.5">
                {stepPrefill.map((s) => {
                  const q = questions.find((f) => f.name === s.field);
                  return (
                    <div key={s.field} className="flex items-center justify-between gap-2 text-[11px] bg-white/70 rounded-lg px-2.5 py-1.5 border border-indigo-100">
                      <span className="font-semibold text-slate-700 truncate">{q?.label || s.field}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-emerald-700 truncate max-w-[12rem]" title={String(s.value)}>
                          {String(s.value)}
                        </span>
                        {s.conflict ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                            Differs
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Blank
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-indigo-800/70 leading-normal">
                Source: {[...new Set(stepPrefill.map((s) => s.source_document).filter(Boolean))].join(', ')}
              </p>

              {blanksHere.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyPrefill}
                  disabled={prefillApplying}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {prefillApplying
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  Fill {blanksHere.length} empty field{blanksHere.length === 1 ? '' : 's'}
                </button>
              )}

              {prefillNote && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <Check className="w-3.5 h-3.5 shrink-0" /> {prefillNote}
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {questions.map((q) => {
                const isRequired = !q.optional && (!q.dependsOn || formData[q.dependsOn] === 'yes');
                const err = errors[q.name];
                const mismatch = mismatchFor(q);
                const fieldClass = `input-field ${err ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : mismatch ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20' : ''}`;
                return (
                <div key={q.name} className="space-y-2 relative group">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      {q.label}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold normal-case tracking-normal ${isRequired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {isRequired ? 'Required' : 'Optional'}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveWhy(activeWhy === q.name ? null : q.name)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Why we're asking this"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {activeWhy === q.name && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-normal animate-slide-up">
                      <strong>Why we're asking this:</strong> {q.why}
                    </div>
                  )}

                  {q.type === 'textarea' ? (
                    <textarea
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      onBlur={() => handleBlur(q)}
                      placeholder={q.placeholder}
                      className={`${fieldClass} min-h-24 py-2 resize-none`}
                    />
                  ) : q.type === 'select' ? (
                    <select
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      onBlur={() => handleBlur(q)}
                      className={`${fieldClass} appearance-none bg-no-repeat bg-right pr-10`}
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
                      onBlur={() => handleBlur(q)}
                      placeholder={q.placeholder}
                      className={fieldClass}
                    />
                  )}

                  {err && (
                    <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  )}

                  {/* Real-time cross-document validation */}
                  {!err && mismatch && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-slide-up">
                      <div className="flex items-start gap-1.5">
                        <FileSearch className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-amber-900 leading-tight">
                            Doesn't match your uploaded document
                          </p>
                          <p className="text-[10px] text-amber-800/80 mt-0.5 truncate" title={mismatch.docName}>
                            Source: {mismatch.docName}
                            {mismatch.docStatus !== 'confirmed' && ' (pending your confirmation)'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-sans font-bold">You entered</p>
                          <p className="font-semibold text-red-700 break-words">{mismatch.enteredDisplay}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-sans font-bold">Document says</p>
                          <p className="font-semibold text-emerald-700 break-words">{mismatch.docDisplay}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleInputChange(q.name, mismatch.suggestedValue)}
                          className="text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Use document value
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedMismatches((prev) => ({ ...prev, [q.name]: true }))}
                          className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline decoration-amber-300"
                        >
                          Keep mine — my value is correct
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}

              {/* Navigation Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-6 mt-8">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-all font-semibold text-xs uppercase self-start"
                >
                  <ArrowLeft className="w-4 h-4" /> Prev Step
                </button>

                <div className="flex flex-wrap gap-3">
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
