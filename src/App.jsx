import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Questions from './pages/Questions';
import Practice from './pages/Practice';
import AddQuestion from './pages/AddQuestion';
import Generate from './pages/Generate';
import Settings from './pages/Settings';
import Toast from './components/Toast';
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 bg-amber-500 text-white text-xs font-medium">
      <WifiOff size={13} />
      You are offline — changes will not be saved
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <OfflineBanner />
      <Toast />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
        <Route path="/practice/:questionId" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
        <Route path="/add-question" element={<ProtectedRoute><AddQuestion /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
