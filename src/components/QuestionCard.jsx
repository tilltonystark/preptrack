import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Pencil, Trash2, PlayCircle } from 'lucide-react';
import PracticeDots from './PracticeDots';

/**
 * Question card for the Question Bank list
 */
export default function QuestionCard({ question, categories, onEdit, onDelete, showCategory = true }) {
  const navigate = useNavigate();
  const category = categories?.find((c) => c.id === question.categoryId);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {showCategory && category && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: category.color || '#6366F1' }}
              >
                {category.name}
              </span>
            )}
            {question.mastered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 size={10} />
                Mastered
              </span>
            )}
            {question.source === 'ai-generated' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                AI
              </span>
            )}
          </div>

          {/* Question text */}
          <p className="text-sm text-gray-900 font-medium leading-snug line-clamp-2">
            {question.question}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <PracticeDots count={question.practiceCount || 0} />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            id={`practice-${question.id}`}
            onClick={() => navigate(`/practice/${question.id}`)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Practice"
          >
            <PlayCircle size={15} />
          </button>
          <button
            id={`edit-${question.id}`}
            onClick={() => onEdit(question)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            id={`delete-${question.id}`}
            onClick={() => onDelete(question)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
