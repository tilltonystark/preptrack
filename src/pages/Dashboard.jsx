import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, TrendingUp, BookOpen, CheckCircle2, Clock, Upload, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import CategoryCard from '../components/CategoryCard';
import SkeletonLoader from '../components/SkeletonLoader';
import PDFUploadModal from '../components/PDFUploadModal';
import { useAuth } from '../context/useAuth';
import { useCategories } from '../hooks/useCategories';
import { getStats, getUser, dismissFirstLoginBanner } from '../lib/firestore';

export default function Dashboard() {
  const { user } = useAuth();
  const { categories, loading: catLoading, refetch: refetchCategories } = useCategories();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Load stats + check first-login banner
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getStats(user.uid),
      getUser(user.uid),
    ]).then(([s, userData]) => {
      setStats(s);
      if (userData && userData.firstLoginBannerDismissed === false) {
        setShowBanner(true);
      }
    }).catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [user]);

  const handleDismissBanner = async () => {
    setShowBanner(false);
    try {
      await dismissFirstLoginBanner(user.uid);
    } catch { /* ignore */ }
  };

  const handleUploadSaved = () => {
    // Refresh stats and categories after saving questions from PDF
    getStats(user.uid).then(setStats).catch(console.error);
    refetchCategories();
  };

  const statCards = [
    { label: 'Total Questions', value: stats?.total ?? '—',     icon: BookOpen,      color: 'text-gray-700',   bg: 'bg-gray-50'   },
    { label: 'Mastered',        value: stats?.mastered ?? '—',  icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'In Progress',     value: stats?.inProgress ?? '—',icon: TrendingUp,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Not Started',     value: stats?.notStarted ?? '—',icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50'  },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* First-login banner */}
        {showBanner && (
          <div className="flex items-start justify-between gap-3 p-3.5 bg-indigo-50 border border-indigo-100 rounded-lg mb-5 text-sm text-indigo-800">
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>We've added starter questions for IIT Jodhpur prep.</strong>{' '}
                Edit, delete, or add your own anytime.
              </span>
            </div>
            <button onClick={handleDismissBanner} className="flex-shrink-0 p-0.5 text-indigo-400 hover:text-indigo-600">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">IIT Jodhpur M.Des / M.Tech Preparation</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              id="upload-pdf-btn"
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 bg-white rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Upload size={14} />
              Upload PDF
            </button>
            <Link
              to="/generate"
              id="generate-questions-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <Sparkles size={14} />
              Generate with AI
            </Link>
            <Link
              to="/add-question"
              id="quick-add-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14} />
              Add Question
            </Link>
          </div>
        </div>

        {/* Stats row */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <SkeletonLoader count={4} variant="stat" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{label}</span>
                  <div className={`w-7 h-7 ${bg} rounded-md flex items-center justify-center`}>
                    <Icon size={13} className={color} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                {label === 'Total Questions' && stats?.completionPct !== undefined && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Completion</span>
                      <span className="text-xs font-medium text-gray-600">{stats.completionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${stats.completionPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Categories */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Categories</h2>
          <Link to="/settings" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Manage →</Link>
        </div>

        {catLoading ? (
          <SkeletonLoader count={3} variant="category" />
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No categories yet.{' '}
            <Link to="/settings" className="text-indigo-600 hover:underline">Add one in Settings</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        )}

        {/* Empty state CTA */}
        {!catLoading && !statsLoading && stats?.total === 0 && (
          <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-lg p-6 text-center">
            <Sparkles size={24} className="text-indigo-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-indigo-900 mb-1">Start your prep</h3>
            <p className="text-xs text-indigo-600 mb-4">Add questions manually, generate with AI, or upload a study document.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link to="/add-question" className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors">
                Add Manually
              </Link>
              <button onClick={() => setShowUploadModal(true)} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors">
                Upload PDF
              </button>
              <Link to="/generate" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">
                Generate with AI
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* PDF Upload Modal */}
      {showUploadModal && (
        <PDFUploadModal
          categories={categories}
          onClose={() => setShowUploadModal(false)}
          onSaved={handleUploadSaved}
        />
      )}
    </div>
  );
}
