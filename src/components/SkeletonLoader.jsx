/**
 * Skeleton loader for question cards and dashboard
 * @param {number} count - number of skeleton cards to show
 * @param {string} variant - 'card' | 'category' | 'stat'
 */
export default function SkeletonLoader({ count = 3, variant = 'card' }) {
  return (
    <div className={variant === 'category' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          {variant === 'card' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[0,1,2].map(j => <div key={j} className="w-2 h-2 rounded-full bg-gray-100" />)}
                </div>
                <div className="flex gap-2">
                  <div className="w-7 h-7 bg-gray-100 rounded-md" />
                  <div className="w-7 h-7 bg-gray-100 rounded-md" />
                  <div className="w-7 h-7 bg-gray-100 rounded-md" />
                </div>
              </div>
            </div>
          )}
          {variant === 'category' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-gray-100 rounded" />
                <div className="w-14 h-14 bg-gray-100 rounded-full" />
              </div>
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          )}
          {variant === 'stat' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="h-3 w-24 bg-gray-100 rounded" />
              <div className="h-7 w-12 bg-gray-100 rounded" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
