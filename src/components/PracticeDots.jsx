/**
 * 3-dot practice count indicator
 * ● ● ○ = 2 practiced, 1 remaining
 * @param {number} count - number of practices done (0–3)
 */
export default function PracticeDots({ count = 0 }) {
  return (
    <div className="flex items-center gap-1" title={`${count}/3 practices`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < count ? 'bg-indigo-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
