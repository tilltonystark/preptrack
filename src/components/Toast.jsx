import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, Trophy } from 'lucide-react';
import { registerToastHandler } from '../lib/toast';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  mastered: Trophy,
};

const COLORS = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  mastered: 'bg-indigo-50 border-indigo-200 text-indigo-800',
};

const ICON_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  mastered: 'text-indigo-500',
};

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return registerToastHandler((message, type, duration) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(({ id, message, type }) => {
        const Icon = ICONS[type] || ICONS.info;
        return (
          <div
            key={id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-sm text-sm max-w-sm animate-slide-in ${COLORS[type]}`}
          >
            <Icon size={16} className={`mt-0.5 flex-shrink-0 ${ICON_COLORS[type]}`} />
            <span>{message}</span>
          </div>
        );
      })}
    </div>
  );
}
