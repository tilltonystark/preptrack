import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, ChevronLeft, ChevronRight, CheckCircle2,
  Mic, MicOff, Upload, Play, Pause, Trash2, AlertCircle, Square,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PracticeDots from '../components/PracticeDots';
import { showToast } from '../lib/toast';
import { useAuth } from '../context/useAuth';
import { getQuestion, incrementPracticeCount, updateVoiceNoteLink, getAdjacentQuestions, getCategories } from '../lib/firestore';
import { uploadAudio, deleteAudio, ALLOWED_TYPES, MAX_SIZE_MB } from '../lib/audioStorage';

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ src, onDelete }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(); }
    finally { setDeleting(false); }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onTimeUpdate={(e) => setProgress((e.target.currentTime / e.target.duration) * 100 || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }} />

      <button onClick={toggle}
        className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 hover:bg-indigo-700">
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = pct * duration;
          }}>
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-xs text-indigo-500">
          <span>{fmt((progress / 100) * duration)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <button onClick={handleDelete} disabled={deleting}
        className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors flex-shrink-0"
        title="Delete recording">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Recorder ────────────────────────────────────────────────────────────────
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRef.current = { recorder, stream };
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return recorder;
    } catch {
      throw new Error('MIC_DENIED');
    }
  };

  const stop = () => new Promise((resolve) => {
    if (!mediaRef.current) { resolve(null); return; }
    const { recorder, stream } = mediaRef.current;
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
      setRecording(false);
      clearInterval(timerRef.current);
      resolve(file);
    };
    recorder.stop();
  });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return { recording, seconds, fmt, start, stop };
}

// ─── Voice Note Panel ─────────────────────────────────────────────────────────
function VoiceNotePanel({ userId, questionId, existingUrl, onSaved }) {
  const [audioUrl, setAudioUrl] = useState(existingUrl || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const { recording, seconds, fmt, start, stop } = useRecorder();

  useEffect(() => { setAudioUrl(existingUrl || ''); }, [existingUrl]);

  const handleUploadFile = async (file) => {
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|ogg|webm|aac)$/i)) {
      showToast('Unsupported format. Use MP3, M4A, WAV, or WebM.', 'error'); return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadAudio(userId, questionId, file, setUploadProgress);
      await onSaved(url);
      setAudioUrl(url);
      showToast('Audio saved ✓', 'success');
    } catch (err) {
      if (err.message?.startsWith('FILE_TOO_LARGE')) showToast(`File must be under ${MAX_SIZE_MB}MB`, 'error');
      else showToast('Upload failed — check Firebase Storage is enabled', 'error');
    } finally { setUploading(false); setUploadProgress(0); }
  };

  const handleRecord = async () => {
    if (recording) {
      const file = await stop();
      if (file) await handleUploadFile(file);
    } else {
      try { await start(); }
      catch { showToast('Microphone access denied', 'error'); }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAudio(audioUrl);
      await onSaved('');
      setAudioUrl('');
      showToast('Recording deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mic size={15} className="text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900">Voice Note</h3>
        <span className="text-xs text-gray-400 ml-auto">Max {MAX_SIZE_MB}MB · MP3, M4A, WAV</span>
      </div>

      {audioUrl ? (
        <AudioPlayer src={audioUrl} onDelete={handleDelete} />
      ) : uploading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-indigo-600">
            <Upload size={12} className="animate-bounce" />
            <span>Uploading… {uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Record button */}
          <button id="record-btn" onClick={handleRecord}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              recording
                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}>
            {recording ? <><Square size={12} /> Stop {fmt(seconds)}</> : <><Mic size={14} /> Record</>}
          </button>

          {/* Upload file */}
          <button id="upload-audio-btn" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
            <Upload size={14} /> Upload File
          </button>

          <input ref={fileInputRef} type="file"
            accept=".mp3,.m4a,.wav,.ogg,.webm,.aac,audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = ''; }} />
        </div>
      )}
    </div>
  );
}

// ─── Practice Page ────────────────────────────────────────────────────────────
export default function Practice() {
  const { questionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [adjacent, setAdjacent] = useState({ prevId: null, nextId: null });
  const [marking, setMarking] = useState(false);
  const [justMastered, setJustMastered] = useState(false);

  useEffect(() => {
    if (!user || !questionId) {
      setQuestion(null); setCategories([]); setAdjacent({ prevId: null, nextId: null }); setLoading(false);
      return;
    }
    setLoading(true); setAnswerVisible(false); setJustMastered(false);
    Promise.all([getQuestion(user.uid, questionId), getCategories(user.uid)])
      .then(async ([q, cats]) => {
        setQuestion(q); setCategories(cats);
        if (q) setAdjacent(await getAdjacentQuestions(user.uid, questionId, q.categoryId));
        else setAdjacent({ prevId: null, nextId: null });
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
      if (newCount >= 3) { setJustMastered(true); showToast('🎉 Mastered! Great work!', 'success'); }
      else showToast(`Practice ${newCount}/3 recorded`, 'success');
    } catch { showToast('Failed to update', 'error'); }
    finally { setMarking(false); }
  };

  const handleAudioSaved = async (url) => {
    await updateVoiceNoteLink(user.uid, questionId, url);
    setQuestion((prev) => prev ? { ...prev, voiceNoteLink: url } : prev);
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
        {/* Nav row */}
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

        {/* Question card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {category && <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: category.color }}>{category.name}</span>}
            {question.mastered && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={10} />Mastered</span>}
            {question.source === 'ai-generated' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">AI</span>}
            {question.source === 'document-upload' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">from doc</span>}
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

        {/* Mark practiced */}
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

        {/* Voice note with upload/record */}
        <VoiceNotePanel
          userId={user.uid}
          questionId={questionId}
          existingUrl={question.voiceNoteLink}
          onSaved={handleAudioSaved}
        />
      </main>
    </div>
  );
}
