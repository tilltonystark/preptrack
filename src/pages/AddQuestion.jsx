import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import { showToast } from '../components/Toast';
import { useCategories } from '../hooks/useCategories';
import { useQuestions } from '../hooks/useQuestions';

export default function AddQuestion() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { addQuestion } = useQuestions();

  const [form, setForm] = useState({ categoryId: '', question: '', idealAnswer: '', voiceNoteLink: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.categoryId) e.categoryId = 'Please select a category';
    if (!form.question.trim()) e.question = 'Question text is required';
    if (form.voiceNoteLink && !form.voiceNoteLink.includes('drive.google.com')) {
      e.voiceNoteLink = 'Must be a Google Drive link';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await addQuestion({
        categoryId: form.categoryId,
        question: form.question.trim(),
        idealAnswer: form.idealAnswer.trim(),
        voiceNoteLink: form.voiceNoteLink.trim(),
        source: 'manual',
      });
      showToast('Question added!', 'success');
      navigate('/questions');
    } catch {
      showToast('Failed to save question', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/questions" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ChevronLeft size={15} />Back to Questions
        </Link>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Add Question</h1>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category */}
            <div>
              <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="category-select"
                value={form.categoryId}
                onChange={set('categoryId')}
                className={`w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.categoryId ? 'border-red-300' : 'border-gray-200'}`}
              >
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
            </div>

            {/* Question */}
            <div>
              <label htmlFor="question-text" className="block text-sm font-medium text-gray-700 mb-1">
                Question <span className="text-red-400">*</span>
              </label>
              <textarea
                id="question-text"
                rows={3}
                placeholder="e.g. Why do you want to pursue M.Des at IIT Jodhpur?"
                value={form.question}
                onChange={set('question')}
                className={`w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.question ? 'border-red-300' : 'border-gray-200'}`}
              />
              {errors.question && <p className="text-xs text-red-500 mt-1">{errors.question}</p>}
            </div>

            {/* Ideal Answer */}
            <div>
              <label htmlFor="ideal-answer" className="block text-sm font-medium text-gray-700 mb-1">
                Ideal Answer <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="ideal-answer"
                rows={5}
                placeholder="Key points, structure, example references…"
                value={form.idealAnswer}
                onChange={set('idealAnswer')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Voice Note Link */}
            <div>
              <label htmlFor="voice-note-url" className="block text-sm font-medium text-gray-700 mb-1">
                Voice Note Link <span className="text-gray-400 font-normal">(Google Drive, optional)</span>
              </label>
              <input
                id="voice-note-url"
                type="url"
                placeholder="https://drive.google.com/file/d/..."
                value={form.voiceNoteLink}
                onChange={set('voiceNoteLink')}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.voiceNoteLink ? 'border-red-300' : 'border-gray-200'}`}
              />
              {errors.voiceNoteLink && <p className="text-xs text-red-500 mt-1">{errors.voiceNoteLink}</p>}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                id="add-question-submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : 'Add Question'}
              </button>
              <Link
                to="/questions"
                className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
