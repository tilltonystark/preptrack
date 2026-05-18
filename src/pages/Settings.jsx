import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { showToast } from '../components/Toast';
import { useCategories } from '../hooks/useCategories';
import { updateExamConfig } from '../lib/firestore';
import { CATEGORY_COLORS } from '../lib/firestore';
import { Pencil, Trash2, Plus, Check, X, GripVertical, LogOut } from 'lucide-react';

const EXAM_TYPES = ['IIT Jodhpur M.Des / M.Tech', 'IIT Bombay IDC', 'NID', 'NIFT', 'Other'];

export default function Settings() {
  const { user, signOut } = useAuth();
  const { categories, addCategory, updateCategory, deleteCategory, getQuestionCount } = useCategories();

  const [examType, setExamType] = useState('IIT Jodhpur M.Des / M.Tech');
  const [savingExam, setSavingExam] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingCat, setDeletingCat] = useState(null);
  const [catDeleteCount, setCatDeleteCount] = useState(0);

  const handleSaveExam = async () => {
    setSavingExam(true);
    try {
      await updateExamConfig(user.uid, { examType });
      showToast('Exam type updated', 'success');
    } catch { showToast('Failed to update', 'error'); }
    finally { setSavingExam(false); }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await addCategory(newCatName.trim());
      setNewCatName('');
      showToast('Category added', 'success');
    } catch { showToast('Failed to add category', 'error'); }
    finally { setAddingCat(false); }
  };

  const handleRename = async (catId) => {
    if (!editName.trim()) return;
    try {
      await updateCategory(catId, { name: editName.trim() });
      setEditingCat(null);
      showToast('Category renamed', 'success');
    } catch { showToast('Failed to rename', 'error'); }
  };

  const confirmDelete = async (cat) => {
    const count = await getQuestionCount(cat.id);
    setCatDeleteCount(count);
    setDeletingCat(cat);
  };

  const handleDelete = async () => {
    try {
      await deleteCategory(deletingCat.id);
      showToast(`Category "${deletingCat.name}" deleted`, 'success');
      setDeletingCat(null);
    } catch { showToast('Failed to delete', 'error'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>

        {/* Account */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Account</h2>
          {user && (
            <div className="flex items-center gap-3 mb-4">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6366F1&color=fff`}
                alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors">
            <LogOut size={14} />Sign out
          </button>
        </section>

        {/* Exam type */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Exam Configuration</h2>
          <div className="flex gap-3">
            <select id="exam-type-setting" value={examType} onChange={(e) => setExamType(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button onClick={handleSaveExam} disabled={savingExam}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60">
              {savingExam ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>

        {/* Categories */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Categories</h2>
          <div className="space-y-2 mb-4">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg hover:bg-gray-50">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {editingCat === cat.id ? (
                  <div className="flex-1 flex gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingCat(null); }}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => handleRename(cat.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                    <button onClick={() => setEditingCat(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
                    <button onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title="Rename">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => confirmDelete(cat)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add category */}
          <div className="flex gap-2">
            <input id="new-category-input" type="text" placeholder="New category name…" value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button id="add-category-btn" onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-60">
              <Plus size={14} />{addingCat ? 'Adding…' : 'Add'}
            </button>
          </div>
        </section>
      </main>

      {/* Delete category confirm */}
      {deletingCat && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Delete "{deletingCat.name}"?</p>
                <p className="text-xs text-gray-500">
                  {catDeleteCount > 0
                    ? `This will permanently delete ${catDeleteCount} question${catDeleteCount > 1 ? 's' : ''} in this category. This cannot be undone.`
                    : 'This category is empty. It will be permanently deleted.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingCat(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
