import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Sparkles, Check, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { showToast } from '../lib/toast';
import { useCategories } from '../hooks/useCategories';
import { useQuestions } from '../hooks/useQuestions';
import { generateQuestions, isRateLimited, getRateLimitRemaining } from '../lib/grok';

const EXAM_TYPES = ['IIT Jodhpur M.Des / M.Tech', 'IIT Bombay IDC', 'NID', 'NIFT', 'Other'];
const MAX_DOC_CHARS = 8000;

const STEPS = ['Configure', 'Review', 'Save'];

export default function Generate() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { addQuestions } = useQuestions();

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const hasApiKey = apiKey && !apiKey.includes('your_gemini');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ topic: '', description: '', examType: EXAM_TYPES[0], categoryId: '' });
  const [errors, setErrors] = useState({});
  const [docText, setDocText] = useState('');
  const [docName, setDocName] = useState('');
  const [docTruncated, setDocTruncated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [rawError, setRawError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // ─── Document parsing ─────────────────────────────────────────────────────
  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setDocName(file.name);
    setDocText('');
    setDocTruncated(false);

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      try {
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
        const trimmed = text.slice(0, MAX_DOC_CHARS);
        setDocText(trimmed);
        setDocTruncated(text.length > MAX_DOC_CHARS);
      } catch {
        showToast('Could not extract PDF text. Paste text manually below.', 'error');
        setDocName('');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result.slice(0, MAX_DOC_CHARS);
        setDocText(text);
        setDocTruncated(e.target.result.length > MAX_DOC_CHARS);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    maxFiles: 1,
  });

  // ─── Generate ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.topic.trim()) e.topic = 'Topic is required';
    if (!form.categoryId) e.categoryId = 'Select a target category';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const startCooldown = () => {
    setCooldown(10);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    if (isRateLimited()) { showToast(`Please wait ${getRateLimitRemaining()}s before generating again`, 'info'); return; }
    setGenerating(true);
    setRawError('');
    try {
      const questions = await generateQuestions(form.topic, form.description, form.examType, docText || null);
      setGeneratedQuestions(questions);
      setSelected(new Set(questions.map((_, i) => i)));
      setStep(1);
      startCooldown();
    } catch (err) {
      if (err.message.startsWith('JSON_PARSE_ERROR:')) {
        const raw = err.message.replace('JSON_PARSE_ERROR:', '');
        setRawError(raw);
        showToast('Could not parse AI response. Showing raw output.', 'error');
      } else if (err.message === 'MISSING_API_KEY') {
        showToast('Grok API key missing — add VITE_GROK_API_KEY in Vercel → Settings → Environment Variables, then redeploy.', 'error');
      } else if (err.message.startsWith('RATE_LIMITED:')) {
        const secs = err.message.split(':')[1];
        showToast(`Rate limited — wait ${secs}s before trying again.`, 'info');
      } else if (err.message.startsWith('API_ERROR:')) {
        const parts = err.message.split(':');
        const status = parts[1];
        const msg = parts.slice(2).join(':') || 'Unknown error';
        showToast(`Grok API error ${status}: ${msg}`, 'error');
      } else {
        showToast(`Generation failed: ${err.message}`, 'error');
      }
    } finally {
      setGenerating(false);
    }
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = generatedQuestions
      .filter((_, i) => selected.has(i))
      .map((q) => ({ ...q, categoryId: form.categoryId, source: 'ai-generated' }));
    if (toSave.length === 0) { showToast('Select at least one question to save', 'info'); return; }
    setSaving(true);
    try {
      await addQuestions(toSave);
      showToast(`${toSave.length} question${toSave.length > 1 ? 's' : ''} saved!`, 'success');
      navigate('/questions');
    } catch { showToast('Failed to save questions', 'error'); }
    finally { setSaving(false); }
  };

  const toggleSelect = (i) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Generate with AI</h1>
          <p className="text-sm text-gray-500">Generate targeted interview questions using Grok AI</p>
        </div>

        {/* API key warning */}
        {!hasApiKey && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-6">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">Gemini API key not configured</p>
              <p className="text-xs mt-0.5">Add <code className="bg-amber-100 px-1 rounded">VITE_GEMINI_API_KEY</code> to your <code className="bg-amber-100 px-1 rounded">.env</code> file to enable AI generation.</p>
            </div>
          </div>
        )}

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${i === step ? 'text-indigo-700' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < step ? <Check size={10} /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 0: Configure */}
        {step === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-red-400">*</span></label>
              <input id="topic-input" type="text" placeholder="e.g. Sustainable Energy Design, XR in Healthcare"
                value={form.topic} onChange={set('topic')}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.topic ? 'border-red-300' : 'border-gray-200'}`} />
              {errors.topic && <p className="text-xs text-red-500 mt-1">{errors.topic}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Context <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea id="topic-description" rows={3} placeholder="Additional context, focus areas, specific aspects to cover…"
                value={form.description} onChange={set('description')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                <select id="exam-type-select" value={form.examType} onChange={set('examType')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Save to Category <span className="text-red-400">*</span></label>
                <select id="target-category-select" value={form.categoryId} onChange={set('categoryId')}
                  className={`w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.categoryId ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">Select category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
              </div>
            </div>

            {/* Document upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Document <span className="text-gray-400 font-normal">(PDF, TXT, MD — optional)</span></label>
              <div {...getRootProps()} id="doc-dropzone"
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input {...getInputProps()} />
                {docName ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                    <FileText size={16} className="text-indigo-500" />
                    <span className="font-medium">{docName}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDocName(''); setDocText(''); setDocTruncated(false); }}
                      className="p-0.5 hover:text-red-500"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    <Upload size={20} className="mx-auto mb-2 text-gray-300" />
                    <p>{isDragActive ? 'Drop here…' : 'Drag a file or click to upload'}</p>
                    <p className="text-xs mt-1">PDF, TXT, or MD — max 8,000 characters extracted</p>
                  </div>
                )}
              </div>
              {docTruncated && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} />Document truncated to 8,000 characters to stay within token limits.
                </p>
              )}
              {docText && (
                <p className="text-xs text-gray-400 mt-1">{docText.length.toLocaleString()} characters extracted</p>
              )}
              {docName && !docText && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Or paste extracted text manually:</p>
                  <textarea rows={4} placeholder="Paste document text here…" value={docText} onChange={(e) => setDocText(e.target.value.slice(0, MAX_DOC_CHARS))}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>

            <button id="generate-btn" onClick={handleGenerate} disabled={generating || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {generating ? <><Loader2 size={15} className="animate-spin" />Generating…</> : cooldown > 0 ? `Wait ${cooldown}s` : <><Sparkles size={15} />Generate Questions</>}
            </button>
          </div>
        )}

        {/* Step 1: Review */}
        {step === 1 && (
          <div className="space-y-4">
            {rawError ? (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-medium text-red-600 mb-2">Raw AI response (parse error):</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-md overflow-auto max-h-80">{rawError}</pre>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{generatedQuestions.length} questions generated — select which to save</p>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelected(new Set(generatedQuestions.map((_, i) => i)))} className="text-indigo-600 hover:underline">All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">None</button>
                  </div>
                </div>
                {generatedQuestions.map((q, i) => (
                  <div key={i}
                    className={`bg-white border rounded-xl p-4 cursor-pointer transition-colors ${selected.has(i) ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}
                    onClick={() => toggleSelect(i)}>
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected.has(i) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                        {selected.has(i) && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-2">{q.question}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{q.idealAnswer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(0)} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">← Back</button>
              <button id="save-questions-btn" onClick={handleSave} disabled={saving || selected.size === 0}
                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Saving…' : `Save ${selected.size} Question${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
