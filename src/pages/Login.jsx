import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { BookOpen, CheckCircle2, Target, Sparkles, AlertTriangle } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Track',
    desc: 'Organise questions across 6 categories tailored for IIT Jodhpur M.Des/M.Tech.',
  },
  {
    icon: CheckCircle2,
    title: 'Practice',
    desc: 'Reveal ideal answers, track your practice count, and build real confidence.',
  },
  {
    icon: Sparkles,
    title: 'Master',
    desc: 'Use AI to generate topic-specific questions and master every corner of your prep.',
  },
];

export default function Login() {
  const { signIn, firebaseReady } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn();
      navigate('/dashboard');
    } catch (err) {
      if (err.message.includes('Firebase is not configured')) {
        setError(err.message);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2 max-w-6xl mx-auto">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">PrepTrack</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Firebase not configured banner */}
        {!firebaseReady && (
          <div className="w-full max-w-md mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium mb-1">Firebase not configured</p>
              <p className="text-xs">
                Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to{' '}
                <code className="bg-amber-100 px-1 rounded">.env</code> and fill in your Firebase
                credentials to enable sign-in. See README.md for setup instructions.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full text-xs font-medium text-indigo-700 mb-4">
            <Sparkles size={12} />
            IIT Jodhpur M.Des / M.Tech Prep
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Ace your interview with structured preparation
          </h1>
          <p className="text-lg text-gray-500">
            PrepTrack helps you build, practice, and master interview questions — powered by AI and designed for design-school aspirants.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-2xl w-full">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center mb-3">
                <Icon size={16} className="text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sign-in */}
        <div className="flex flex-col items-center gap-3">
          {error && (
            <p className="text-sm text-red-600 max-w-sm text-center">{error}</p>
          )}
          <button
            id="google-signin-btn"
            onClick={handleSignIn}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Sign in with Google'}
          </button>
          <p className="text-xs text-gray-400">Your data is private — only you can see it</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        PrepTrack — Built for IIT Jodhpur M.Des / M.Tech aspirants
      </footer>
    </div>
  );
}
