import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, X, BookOpen } from 'lucide-react';
import Navbar from '../components/Navbar';
import QuestionCard from '../components/QuestionCard';
import SkeletonLoader from '../components/SkeletonLoader';
import { showToast } from '../lib/toast';
import { useQuestions } from '../hooks/useQuestions';
import { useCategories } from '../hooks/useCategories';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'not-started', label: 'Not Started' },
];

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { categories } = useCategories();
  const { questions, loading, deleteQuestion, updateQuestion } = useQuestions();

  // Apply filters client-side
  const filtered = questions.filter((q) => {
    const matchesSearch = !search || q.question.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || q.categoryId === categoryFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'mastered' && q.mastered) ||
      (statusFilter === 'in-progress' && !q.mastered && q.practiceCount > 0) ||
      (statusFilter === 'not-started' && q.practiceCount === 0);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDelete = async (question) => {
    try {
      await deleteQuestion(question.id);
      showToast('Question deleted', 'success');
      setDeleteConfirm(null);
    } catch {
      showToast('Failed to delete question', 'error');
    }
  };

  const handleEditSave = async (questionId, updates) => {
    try {
      await updateQuestion(questionId, updates);
      showToast('Question updated', 'success');
      setEditingQuestion(null);
    } catch {
      showToast('Failed to update question', 'error');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
    setSearchParams({});
  };

  const hasFilters = search || categoryFilter || statusFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? '—' : `${filtered.length} question${filtered.length !== 1 ? 's' : ''}`}
              {hasFilters && ' (filtered)'}
            </p>
          </div>
          <Link
            to="/add-question"
            id="add-question-link"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} />
            Add Question
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="question-search"
              type="text"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Category filter */}
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setSearchParams(e.target.value ? { category: e.target.value } : {}); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>

        {/* Question list */}
        {loading ? (
          <SkeletonLoader count={5} variant="card" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">
              {hasFilters ? 'No questions match your filters' : 'No questions yet'}
            </p>
            {!hasFilters && (
              <div className="flex justify-center gap-3 mt-4">
                <Link to="/add-question" className="text-sm text-indigo-600 hover:underline">
                  Add manually
                </Link>
                <span className="text-gray-300">or</span>
                <Link to="/generate" className="text-sm text-indigo-600 hover:underline">
                  Generate with AI
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                categories={categories}
                onEdit={setEditingQuestion}
                onDelete={setDeleteConfirm}
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit modal */}
      {editingQuestion && (
        <EditModal
          question={editingQuestion}
          categories={categories}
          onSave={handleEditSave}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          message={`Delete "${deleteConfirm.question.slice(0, 60)}${deleteConfirm.question.length > 60 ? '…' : ''}"?`}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

function EditModal({ question, categories, onSave, onClose }) {
  const [text, setText] = useState(question.question);
  const [answer, setAnswer] = useState(question.idealAnswer || '');
  const [categoryId, setCategoryId] = useState(question.categoryId || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!text.trim()) e.text = 'Question is required';
    if (!categoryId) e.category = 'Category is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave(question.id, { question: text.trim(), idealAnswer: answer.trim(), categoryId });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit Question</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.category ? 'border-red-300' : 'border-gray-200'}`}
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Question *</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${errors.text ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.text && <p className="text-xs text-red-500 mt-1">{errors.text}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ideal Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Delete Question?</p>
            <p className="text-xs text-gray-500">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
