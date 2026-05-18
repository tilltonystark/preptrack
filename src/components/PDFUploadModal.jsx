import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  X, Upload, FileText, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Check, RefreshCw
} from 'lucide-react';
import { generateAndCategoriseFromDocument } from '../lib/grok';
import { addQuestions } from '../lib/firestore';
import { showToast } from './Toast';
import { useAuth } from '../context/AuthContext';

const MAX_CHARS = 12000;
const MIN_CHARS = 200;

const CATEGORY_KEYS = [
  { key: 'personal',   label: 'Personal Questions',   color: '#6366F1' },
  { key: 'case_study', label: 'Case Study Questions', color: '#10B981' },
  { key: 'technical',  label: 'Technical Questions',  color: '#F59E0B' },
];

/**
 * Global PDF Upload Modal with auto-categorisation via Grok
 */
export default function PDFUploadModal({ categories, onClose, onSaved }) {
  const { user } = useAuth();

  // Step: 'upload' | 'loading' | 'review'
  const [step, setStep] = useState('upload');
  const [loadingStep, setLoadingStep] = useState(''); // 'reading' | 'generating'

  const [docName, setDocName] = useState('');
  const [docText, setDocText] = useState('');
  const [docTruncated, setDocTruncated] = useState(false);
  const [manualPaste, setManualPaste] = useState(false);
  const [extractError, setExtractError] = useState('');

  const [generated, setGenerated] = useState(null); // { personal, case_study, technical }
  const [selected, setSelected] = useState({});      // { [key_i]: true/false }
  const [edited, setEdited] = useState({});          // { [key_i]: { question, idealAnswer } }
  const [expanded, setExpanded] = useState({});      // { [key_i]: bool } show ideal answer
  const [activeTab, setActiveTab] = useState('personal');

  // Category overrides for saving (if user's categories don't match default names)
  const [catOverrides, setCatOverrides] = useState({
    personal:   null,
    case_study: null,
    technical:  null,
  });

  const [rawError, setRawError] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setExtractError('');
    setDocName(file.name);
    setDocText('');
    setDocTruncated(false);
    setManualPaste(false);
    setLoadingStep('reading');

    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf') {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }
        if (!text.trim()) throw new Error('no_text');
        setDocText(text.slice(0, MAX_CHARS));
        setDocTruncated(text.length > MAX_CHARS);
      } else {
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target.result;
            setDocText(text.slice(0, MAX_CHARS));
            setDocTruncated(text.length > MAX_CHARS);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }
    } catch {
      setExtractError('Could not extract text from this file. Please paste the text manually below.');
      setManualPaste(true);
    } finally {
      setLoadingStep('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    maxFiles: 1,
  });

  // ─── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const text = docText.trim();
    if (text.length < MIN_CHARS) {
      showToast("The document doesn't seem to have enough content. Try a different file or paste text manually.", 'error');
      return;
    }
    setStep('loading');
    setLoadingStep('generating');
    setRawError('');
    try {
      const result = await generateAndCategoriseFromDocument(text, 'IIT Jodhpur M.Des / M.Tech');
      // Build initial selected + edited state
      const sel = {};
      const ed = {};
      CATEGORY_KEYS.forEach(({ key }) => {
        (result[key] || []).forEach((q, i) => {
          sel[`${key}_${i}`] = true;
          ed[`${key}_${i}`] = { question: q.question, idealAnswer: q.idealAnswer };
        });
      });
      setGenerated(result);
      setSelected(sel);
      setEdited(ed);
      // Auto-set category overrides by matching name
      const overrides = {};
      CATEGORY_KEYS.forEach(({ key, label }) => {
        const match = categories.find((c) => c.name.toLowerCase().includes(label.split(' ')[0].toLowerCase()));
        overrides[key] = match?.id || null;
      });
      setCatOverrides(overrides);
      setStep('review');
    } catch (err) {
      if (err.message.startsWith('JSON_PARSE_ERROR:')) {
        setRawError(err.message.replace('JSON_PARSE_ERROR:', ''));
        setStep('review');
      } else {
        showToast('Question generation failed. Check your Grok API key or try again.', 'error');
        setStep('upload');
      }
    } finally {
      setLoadingStep('');
    }
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Check all category overrides are set
    const missing = CATEGORY_KEYS.filter(({ key }) => {
      const hasQuestions = Object.keys(selected).some((k) => k.startsWith(key) && selected[k]);
      return hasQuestions && !catOverrides[key];
    });
    if (missing.length > 0) {
      showToast(`Please assign a category for: ${missing.map((m) => m.label).join(', ')}`, 'error');
      return;
    }

    const toSave = [];
    CATEGORY_KEYS.forEach(({ key }) => {
      const catId = catOverrides[key];
      if (!catId) return;
      Object.keys(selected).forEach((k) => {
        if (!k.startsWith(key + '_') || !selected[k]) return;
        const data = edited[k] || {};
        toSave.push({
          categoryId: catId,
          question: data.question || '',
          idealAnswer: data.idealAnswer || '',
          source: 'document-upload',
        });
      });
    });

    if (toSave.length === 0) {
      showToast('No questions selected. Select at least one to save.', 'error');
      return;
    }

    setSaving(true);
    try {
      await addQuestions(user.uid, toSave);
      const catCount = new Set(toSave.map((q) => q.categoryId)).size;
      showToast(`${toSave.length} question${toSave.length > 1 ? 's' : ''} added across ${catCount} categor${catCount > 1 ? 'ies' : 'y'}`, 'success');
      onSaved?.();
      onClose();
    } catch {
      showToast('Failed to save questions', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const toggleSelected = (key) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleExpanded = (key) =>
    setSelected((prev) => { void prev; return prev; }) ||
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const setField = (key, field, value) =>
    setEdited((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const tabQuestions = (key) => generated?.[key] || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Upload PDF / Document</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'upload' && 'Upload a study document — AI will generate and categorise questions automatically'}
              {step === 'loading' && (loadingStep === 'reading' ? 'Reading document…' : 'Generating questions…')}
              {step === 'review' && `${selectedCount} question${selectedCount !== 1 ? 's' : ''} selected across 3 categories`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="p-5 space-y-4">
              {/* Dropzone */}
              <div {...getRootProps()} id="pdf-upload-dropzone"
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input {...getInputProps()} />
                {docName && !extractError ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-800">
                    <FileText size={18} className="text-indigo-500" />
                    <span className="font-medium">{docName}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDocName(''); setDocText(''); setDocTruncated(false); setManualPaste(false); }}
                      className="p-0.5 hover:text-red-500 ml-1"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    <Upload size={24} className="mx-auto mb-3 text-gray-300" />
                    {isDragActive ? (
                      <p className="text-indigo-600 font-medium">Drop it here…</p>
                    ) : (
                      <>
                        <p className="font-medium text-gray-600">Drag a file or click to upload</p>
                        <p className="text-xs mt-1">PDF, TXT, or MD — up to 12,000 characters extracted</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Extraction error */}
              {extractError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  {extractError}
                </div>
              )}

              {/* Stats */}
              {docText && !manualPaste && (
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{docText.length.toLocaleString()} characters extracted</span>
                  {docTruncated && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle size={11} />Truncated to 12,000 chars
                    </span>
                  )}
                </div>
              )}

              {/* Manual paste fallback */}
              {(manualPaste || (!docText && docName)) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Paste document text manually</label>
                  <textarea rows={6} placeholder="Paste extracted or copied text here…"
                    value={docText} onChange={(e) => setDocText(e.target.value.slice(0, MAX_CHARS))}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="text-xs text-gray-400 mt-1">{docText.length}/{MAX_CHARS} characters</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step: Loading ── */}
          {step === 'loading' && (
            <div className="p-12 flex flex-col items-center gap-4">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">
                  {loadingStep === 'reading' ? 'Reading document…' : 'Generating questions…'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {loadingStep === 'generating' && 'Grok AI is analysing your document and categorising questions'}
                </p>
              </div>
              <div className="flex items-center gap-6 mt-2">
                {['Reading document…', 'Generating questions…'].map((label, i) => {
                  const isDone = (loadingStep === 'generating' && i === 0);
                  const isActive = (loadingStep === 'reading' && i === 0) || (loadingStep === 'generating' && i === 1);
                  return (
                    <div key={label} className={`flex items-center gap-2 text-xs ${isDone ? 'text-green-600' : isActive ? 'text-indigo-600' : 'text-gray-300'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${isDone ? 'bg-green-100' : isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        {isDone ? <Check size={10} /> : isActive ? <Loader2 size={10} className="animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                      </span>
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step: Review ── */}
          {step === 'review' && (
            <div className="p-5">
              {rawError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-amber-800 mb-2">Could not parse AI response:</p>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border overflow-auto max-h-48">{rawError}</pre>
                  <button onClick={() => { setStep('upload'); setRawError(''); }}
                    className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 hover:underline">
                    <RefreshCw size={11} />Try again
                  </button>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-gray-100 mb-4">
                    {CATEGORY_KEYS.map(({ key, label, color }) => {
                      const count = tabQuestions(key).length;
                      return (
                        <button key={key} onClick={() => setActiveTab(key)}
                          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          {label.replace(' Questions', '')}
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Category override (if no match found) */}
                  {CATEGORY_KEYS.map(({ key, label, color }) => {
                    if (activeTab !== key) return null;
                    return (
                      <div key={key}>
                        {/* Category assignment */}
                        <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 rounded-lg">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs text-gray-500 flex-shrink-0">Save to:</span>
                          <select
                            value={catOverrides[key] || ''}
                            onChange={(e) => setCatOverrides((prev) => ({ ...prev, [key]: e.target.value || null }))}
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="">— select category —</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        {/* Select all/none for this tab */}
                        <div className="flex justify-end gap-2 mb-2">
                          <button onClick={() => tabQuestions(key).forEach((_, i) => setSelected((p) => ({ ...p, [`${key}_${i}`]: true })))}
                            className="text-xs text-indigo-600 hover:underline">All</button>
                          <span className="text-gray-300 text-xs">|</span>
                          <button onClick={() => tabQuestions(key).forEach((_, i) => setSelected((p) => ({ ...p, [`${key}_${i}`]: false })))}
                            className="text-xs text-gray-500 hover:underline">None</button>
                        </div>

                        {/* Questions */}
                        <div className="space-y-2">
                          {tabQuestions(key).map((_, i) => {
                            const itemKey = `${key}_${i}`;
                            const isSelected = selected[itemKey];
                            const isExpanded = expanded[itemKey];
                            const data = edited[itemKey] || {};
                            return (
                              <div key={itemKey}
                                className={`border rounded-lg transition-colors ${isSelected ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'}`}>
                                <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => toggleSelected(itemKey)}>
                                  <div className={`w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                    {isSelected && <Check size={10} className="text-white" />}
                                  </div>
                                  <p className="flex-1 text-sm text-gray-900 font-medium leading-snug">
                                    {data.question}
                                  </p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpanded((p) => ({ ...p, [itemKey]: !p[itemKey] })); }}
                                    className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2" onClick={(e) => e.stopPropagation()}>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Question</label>
                                      <textarea rows={2} value={data.question || ''}
                                        onChange={(e) => setField(itemKey, 'question', e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Ideal Answer</label>
                                      <textarea rows={3} value={data.idealAnswer || ''}
                                        onChange={(e) => setField(itemKey, 'idealAnswer', e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button id="generate-from-doc-btn" onClick={handleGenerate}
                disabled={!docText || docText.trim().length < MIN_CHARS}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Loader2 size={14} className={loadingStep ? 'animate-spin' : 'hidden'} />
                Generate Questions →
              </button>
            </>
          )}
          {step === 'review' && !rawError && (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
                ← Back
              </button>
              <button id="save-doc-questions-btn" onClick={handleSave}
                disabled={saving || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : `Save ${selectedCount} Question${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
