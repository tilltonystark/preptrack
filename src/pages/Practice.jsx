import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ChevronLeft, ChevronRight, CheckCircle2, Mic, ExternalLink, Info, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import PracticeDots from '../components/PracticeDots';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getQuestion, incrementPracticeCount, updateVoiceNoteLink, getAdjacentQuestions, getCategories } from '../lib/firestore';

export default function Practice() {
  const { questionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [adjacent, setAdjacent] = useState({ prevId: null, nextId: null });
  const [voiceLink, setVoiceLink] = useState('');
  const [voiceLinkInput, setVoiceLinkInput] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [marking, setMarking] = useState(false);
  const [justMastered, setJustMastered] = useState(false);

  useEffect(() => {
    if (!user || !questionId) return;
    setLoading(true);
    setAnswerVisible(false);
    setJustMastered(false);
    Promise.all([getQuestion(user.uid, questionId), getCategories(user.uid)])
      .then(async ([q, cats]) => {
        setQuestion(q);
        setCategories(cats);
        setVoiceLink(q?.voiceNoteLink || '');
        if (q) {
          const adj = await getAdjacentQuestions(user.uid, questionId, q.categoryId);
          setAdjacent(adj);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, questionId]);

  const category = categories.find((c) => c.id === question?.categoryId);

  const handleMarkPracticed = async () => {
    if (!question || question.practiceCount >= 3) return;
    setMarking(true);
    try {
      const newCount = await incrementPracticeCount(user.uid, questionId, question.practiceCount);
      setQuestion((prev) => ({ ...prev, practiceCount: newCount, mastered: newCount >= 3 }));
      if (newCount >= 3) { setJustMastered(true); showToast('🎉 Mastered! Great work!', 'mastered'); }
      else showToast(`Practice ${newCount}/3 recorded`, 'success');
    } catch { showToast('Failed to update', 'error'); }
    finally { setMarking(false); }
  };

  const handleSaveVoiceLink = async () => {
    const url = voiceLinkInput.trim();
    setLinkError('');
    if (!url.includes('drive.google.com')) {
      setLinkError('Must be a Google Drive link (drive.google.com)');
      return;
    }
    setSavingLink(true);
    try {
      await updateVoiceNoteLink(user.uid, questionId, url);
      setVoiceLink(url); setVoiceLinkInput('');
      showToast('Voice note link saved', 'success');
    } catch { showToast('Failed to save link', 'error'); }
    finally { setSavingLink(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-32" />
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="h-6 bg-gray-100 rounded w-3/4" /><div className="h-6 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  );

  if (!question) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-4">Question not found</p>
        <Link to="/questions" className="text-sm text-indigo-600 hover:underline">← Back to Questions</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/questions" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft size={15} />Back to Questions
          </Link>
          <div className="flex items-center gap-2">
            <button id="prev-question" onClick={() => adjacent.prevId && navigate(`/practice/${adjacent.prevId}`)} disabled={!adjacent.prevId}
              className="p-1.5 border border-gray-200 rounded-md text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={15} />
            </button>
            <button id="next-question" onClick={() => adjacent.nextId && navigate(`/practice/${adjacent.nextId}`)} disabled={!adjacent.nextId}
              className="p-1.5 border border-gray-200 rounded-md text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {category && <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: category.color }}>{category.name}</span>}
            {question.mastered && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={10} />Mastered</span>}
            {question.source === 'ai-generated' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">AI</span>}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 leading-snug mb-6">{question.question}</h2>
          <div className="flex items-center gap-3 mb-6">
            <PracticeDots count={question.practiceCount || 0} />
            <span className="text-xs text-gray-400">{question.practiceCount || 0}/3 practices</span>
          </div>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button id="reveal-answer-btn" onClick={() => setAnswerVisible(!answerVisible)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700">
              <span>{answerVisible ? 'Hide Ideal Answer' : 'Reveal Ideal Answer'}</span>
              {answerVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            {answerVisible && (
              <div className="px-4 py-4">
                {question.idealAnswer
                  ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{question.idealAnswer}</p>
                  : <p className="text-sm text-gray-400 italic">No ideal answer added yet.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          {(justMastered || question.mastered) ? (
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 size={20} className="text-green-500" />
              <div><p className="text-sm font-semibold">Already mastered!</p><p className="text-xs text-green-600">Keep reviewing for reinforcement.</p></div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-gray-900">Mark as Practiced</p><p className="text-xs text-gray-400 mt-0.5">{question.practiceCount || 0} of 3 done</p></div>
              <button id="mark-practiced-btn" onClick={handleMarkPracticed} disabled={marking}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60">
                {marking ? 'Saving…' : '✓ Mark Practiced'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Mic size={15} className="text-gray-400" /><h3 className="text-sm font-medium text-gray-900">Voice Note</h3></div>
          {voiceLink ? (
            <div className="space-y-2">
              <a href={voiceLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100">
                <ExternalLink size={13} />Open Voice Note (Google Drive)
              </a>
              <button onClick={() => setVoiceLink('')} className="ml-3 text-xs text-gray-400 hover:text-gray-600">Change link</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                <span><strong>Tip:</strong> Record on your phone → upload to Google Drive → share link → paste here</span>
              </div>
              <div className="flex gap-2">
                <input id="voice-note-input" type="url" placeholder="https://drive.google.com/file/d/..." value={voiceLinkInput}
                  onChange={(e) => { setVoiceLinkInput(e.target.value); setLinkError(''); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button id="save-voice-link-btn" onClick={handleSaveVoiceLink} disabled={savingLink || !voiceLinkInput.trim()}
                  className="px-3 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-900 disabled:opacity-60">
                  {savingLink ? '…' : 'Save'}
                </button>
              </div>
              {linkError && <p className="text-xs text-red-500">{linkError}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
