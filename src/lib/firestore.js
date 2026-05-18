// All Firestore CRUD operations for PrepTrack
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

// Category color palette (cycles if more than 8 categories)
export const CATEGORY_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#14B8A6', // teal
];

// Default categories for new users
const DEFAULT_CATEGORIES = [
  { name: 'Personal Questions', order: 0 },
  { name: 'Case Study Questions', order: 1 },
  { name: 'XR & Emerging Tech Questions', order: 2 },
  { name: 'Branch / Discipline Questions', order: 3 },
  { name: 'Research & Thesis Questions', order: 4 },
  { name: 'Current Affairs & Design', order: 5 },
];

// ─── User ────────────────────────────────────────────────────────────────────

/**
 * Initialize a new user's Firestore document with defaults
 */
export const initUserData = async (userId, userData) => {
  const userRef = doc(db, 'users', userId);
  const existing = await getDoc(userRef);

  // Create user document if it doesn't exist
  if (!existing.exists()) {
    await setDoc(userRef, {
      name: userData.displayName || '',
      email: userData.email || '',
      createdAt: serverTimestamp(),
      examConfig: {
        examType: 'IIT Jodhpur M.Des / M.Tech',
        targetYear: new Date().getFullYear().toString(),
      },
    });

    // Create default categories
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach((cat, index) => {
      const catRef = doc(collection(db, 'users', userId, 'categories'));
      batch.set(catRef, {
        name: cat.name,
        order: cat.order,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
};

/**
 * Get user document
 */
export const getUser = async (userId) => {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Update user's exam config
 */
export const updateExamConfig = async (userId, examConfig) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { examConfig });
};

// ─── Categories ──────────────────────────────────────────────────────────────

/**
 * Get all categories for a user, ordered by order field
 */
export const getCategories = async (userId) => {
  const q = query(
    collection(db, 'users', userId, 'categories'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Add a new category
 */
export const addCategory = async (userId, name, existingCount) => {
  const catRef = collection(db, 'users', userId, 'categories');
  const docRef = await addDoc(catRef, {
    name,
    order: existingCount,
    color: CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Update a category
 */
export const updateCategory = async (userId, categoryId, updates) => {
  const catRef = doc(db, 'users', userId, 'categories', categoryId);
  await updateDoc(catRef, updates);
};

/**
 * Delete a category and all its questions
 */
export const deleteCategory = async (userId, categoryId) => {
  // Delete all questions in this category first
  const questionsQuery = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const questionSnap = await getDocs(questionsQuery);

  const batch = writeBatch(db);
  questionSnap.docs.forEach((d) => batch.delete(d.ref));

  // Delete the category itself
  const catRef = doc(db, 'users', userId, 'categories', categoryId);
  batch.delete(catRef);

  await batch.commit();
};

/**
 * Get count of questions in a category
 */
export const getCategoryQuestionCount = async (userId, categoryId) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const snap = await getDocs(q);
  return snap.size;
};

// ─── Questions ───────────────────────────────────────────────────────────────

/**
 * Get all questions for a user, optionally filtered
 */
export const getQuestions = async (userId, filters = {}) => {
  let q = query(
    collection(db, 'users', userId, 'questions'),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  let questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Client-side filtering (Firestore compound queries need indexes)
  if (filters.categoryId) {
    questions = questions.filter((q) => q.categoryId === filters.categoryId);
  }
  if (filters.status === 'mastered') {
    questions = questions.filter((q) => q.mastered === true);
  } else if (filters.status === 'in-progress') {
    questions = questions.filter((q) => !q.mastered && q.practiceCount > 0);
  } else if (filters.status === 'not-started') {
    questions = questions.filter((q) => q.practiceCount === 0);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    questions = questions.filter(
      (q) =>
        q.question.toLowerCase().includes(term) ||
        q.idealAnswer?.toLowerCase().includes(term)
    );
  }

  return questions;
};

/**
 * Get a single question by ID
 */
export const getQuestion = async (userId, questionId) => {
  const questionRef = doc(db, 'users', userId, 'questions', questionId);
  const snap = await getDoc(questionRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Add a new question
 */
export const addQuestion = async (userId, questionData) => {
  const questionsRef = collection(db, 'users', userId, 'questions');
  const docRef = await addDoc(questionsRef, {
    ...questionData,
    practiceCount: 0,
    mastered: false,
    source: questionData.source || 'manual',
    voiceNoteLink: questionData.voiceNoteLink || '',
    createdAt: serverTimestamp(),
    lastPracticedAt: null,
  });
  return docRef.id;
};

/**
 * Add multiple questions (for AI-generated batch)
 */
export const addQuestions = async (userId, questionsData) => {
  const batch = writeBatch(db);
  const ids = [];

  questionsData.forEach((q) => {
    const ref = doc(collection(db, 'users', userId, 'questions'));
    batch.set(ref, {
      ...q,
      practiceCount: 0,
      mastered: false,
      source: 'ai-generated',
      voiceNoteLink: '',
      createdAt: serverTimestamp(),
      lastPracticedAt: null,
    });
    ids.push(ref.id);
  });

  await batch.commit();
  return ids;
};

/**
 * Update a question
 */
export const updateQuestion = async (userId, questionId, updates) => {
  const questionRef = doc(db, 'users', userId, 'questions', questionId);
  await updateDoc(questionRef, updates);
};

/**
 * Delete a question
 */
export const deleteQuestion = async (userId, questionId) => {
  const questionRef = doc(db, 'users', userId, 'questions', questionId);
  await deleteDoc(questionRef);
};

/**
 * Increment practice count (max 3), set mastered at 3
 */
export const incrementPracticeCount = async (userId, questionId, currentCount) => {
  if (currentCount >= 3) return; // Already mastered

  const questionRef = doc(db, 'users', userId, 'questions', questionId);
  const newCount = currentCount + 1;

  await updateDoc(questionRef, {
    practiceCount: newCount,
    mastered: newCount >= 3,
    lastPracticedAt: serverTimestamp(),
  });

  return newCount;
};

/**
 * Update voice note link on a question
 */
export const updateVoiceNoteLink = async (userId, questionId, link) => {
  const questionRef = doc(db, 'users', userId, 'questions', questionId);
  await updateDoc(questionRef, { voiceNoteLink: link });
};

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Get overall stats for the dashboard
 */
export const getStats = async (userId) => {
  const snap = await getDocs(collection(db, 'users', userId, 'questions'));
  const questions = snap.docs.map((d) => d.data());

  const total = questions.length;
  const mastered = questions.filter((q) => q.mastered).length;
  const inProgress = questions.filter((q) => !q.mastered && q.practiceCount > 0).length;
  const notStarted = questions.filter((q) => q.practiceCount === 0).length;
  const completionPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return { total, mastered, inProgress, notStarted, completionPct };
};

/**
 * Get per-category stats
 */
export const getCategoryStats = async (userId, categoryId) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const snap = await getDocs(q);
  const questions = snap.docs.map((d) => d.data());

  const total = questions.length;
  const mastered = questions.filter((q) => q.mastered).length;

  return { total, mastered };
};

/**
 * Get adjacent question IDs in same category for Practice navigation
 */
export const getAdjacentQuestions = async (userId, questionId, categoryId) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const ids = snap.docs.map((d) => d.id);
  const currentIndex = ids.indexOf(questionId);

  return {
    prevId: currentIndex > 0 ? ids[currentIndex - 1] : null,
    nextId: currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null,
  };
};
