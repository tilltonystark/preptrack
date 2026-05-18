import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProgressRing from './ProgressRing';
import { getCategoryStats } from '../lib/firestore';
import { useAuth } from '../context/useAuth';

/**
 * Category card shown on the Dashboard with animated progress ring
 */
export default function CategoryCard({ category }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, mastered: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !category?.id) return;
    getCategoryStats(user.uid, category.id).then((s) => {
      setStats(s);
      // Small delay to trigger the ring animation after mount
      setTimeout(() => setLoaded(true), 100);
    });
  }, [user, category?.id]);

  const progress = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;

  return (
    <Link
      to={`/questions?category=${category.id}`}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all group block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Color dot + name */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color || '#6366F1' }}
            />
            <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
              {category.name}
            </h3>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            {stats.mastered} / {stats.total} mastered
          </p>

          <div className="flex items-center gap-1 mt-3 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View questions
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Progress Ring with percentage */}
        <div className="flex-shrink-0 relative">
          <ProgressRing
            progress={loaded ? progress : 0}
            color={category.color || '#6366F1'}
            size={56}
            strokeWidth={5}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
            {progress}%
          </span>
        </div>
      </div>
    </Link>
  );
}
