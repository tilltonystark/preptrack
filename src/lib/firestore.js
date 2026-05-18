// All Firestore CRUD operations for PrepTrack
import {
  doc,
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
} from 'firebase/firestore';
import { db } from './firebase';
import {
  PERSONAL_QUESTIONS,
  CASE_STUDY_QUESTIONS,
  TECHNICAL_QUESTIONS,
} from './defaultQuestions';

// Category color palette (cycles if more than 8 categories)
export const CATEGORY_COLORS = [
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#3B82F6', // blue
  '#EF4444', // red
  '#14B8A6', // teal
];

// Default 3 categories for new users
const DEFAULT_CATEGORIES = [
  { name: 'Personal Questions',  order: 0, color: '#6366F1' },
  { name: 'Case Study Questions', order: 1, color: '#10B981' },
  { name: 'Technical Questions',  order: 2, color: '#F59E0B' },
];

// Default seeded questions (source: "default")
// Sections: Personal (S2+S5), Case Study (S1 portfolio), Technical (S3 SPD + S4 XR)
const DEFAULT_QUESTIONS = {
  personal:   PERSONAL_QUESTIONS,
  case_study: CASE_STUDY_QUESTIONS,
  technical:  TECHNICAL_QUESTIONS,
};

const DEFAULT_QUESTION_GROUPS = [
  { key: 'personal', catName: 'Personal Questions' },
  { key: 'case_study', catName: 'Case Study Questions' },
  { key: 'technical', catName: 'Technical Questions' },
];

const createUserDocData = (userData) => ({
  name: userData.displayName || '',
  email: userData.email || '',
  createdAt: serverTimestamp(),
  examConfig: {
    examType: 'IIT Jodhpur M.Des / M.Tech',
    targetYear: new Date().getFullYear().toString(),
  },
  firstLoginBannerDismissed: false,
});

const seedDefaultQuestions = (batch, userId, categoryRefsByName) => {
  DEFAULT_QUESTION_GROUPS.forEach(({ key, catName }) => {
    const categoryRef = categoryRefsByName[catName];
    if (!categoryRef) return;

    DEFAULT_QUESTIONS[key].forEach((q) => {
      const qRef = doc(collection(db, 'users', userId, 'questions'));
      batch.set(qRef, {
        categoryId: categoryRef.id,
        question: q.question,
        idealAnswer: q.idealAnswer,
        practiceCount: 0,
        mastered: false,
        source: 'default',
        voiceNoteLink: '',
        createdAt: serverTimestamp(),
        lastPracticedAt: null,
      });
    });
  });
};


/**
 * Initialize a new user's Firestore data, and backfill defaults for older users
 */
export const initUserData = async (userId, userData) => {
  const userRef = doc(db, 'users', userId);
  const categoriesRef = collection(db, 'users', userId, 'categories');
  const questionsRef = collection(db, 'users', userId, 'questions');

  const [existingUser, categoriesSnap, questionsSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(categoriesRef),
    getDocs(questionsRef),
  ]);

  const batch = writeBatch(db);
  let hasWrites = false;

  if (!existingUser.exists()) {
    batch.set(userRef, createUserDocData(userData));
    hasWrites = true;
  }

  const categoryRefsByName = {};

  categoriesSnap.docs.forEach((snap) => {
    const data = snap.data();
    if (data?.name) {
      categoryRefsByName[data.name] = snap.ref;
    }
  });

  DEFAULT_CATEGORIES.forEach((cat) => {
    if (categoryRefsByName[cat.name]) return;

    const ref = doc(categoriesRef);
    categoryRefsByName[cat.name] = ref;
    batch.set(ref, {
      name: cat.name,
      order: cat.order,
      color: cat.color,
      createdAt: serverTimestamp(),
    });
    hasWrites = true;
  });

  const hasAnyQuestions = questionsSnap.size > 0;
  if (!hasAnyQuestions) {
    seedDefaultQuestions(batch, userId, categoryRefsByName);
    hasWrites = true;
  }

  if (hasWrites) {
    await batch.commit();
  }
};

/**
 * Dismiss the first-login banner (store in Firestore so it never shows again)
 */
export const dismissFirstLoginBanner = async (userId) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { firstLoginBannerDismissed: true });
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

export const getCategories = async (userId) => {
  const q = query(
    collection(db, 'users', userId, 'categories'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addCategory = async (userId, name, existingCount) => {
  const trimmedName = name.trim();
  if (!userId) {
    throw new Error('Missing user ID');
  }
  if (!trimmedName) {
    throw new Error('Category name is required');
  }

  const count =
    typeof existingCount === 'number'
      ? existingCount
      : (await getDocs(collection(db, 'users', userId, 'categories'))).size;

  const catRef = collection(db, 'users', userId, 'categories');
  const docRef = await addDoc(catRef, {
    name: trimmedName,
    order: count,
    color: CATEGORY_COLORS[count % CATEGORY_COLORS.length],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateCategory = async (userId, categoryId, updates) => {
  const catRef = doc(db, 'users', userId, 'categories', categoryId);
  await updateDoc(catRef, updates);
};

export const deleteCategory = async (userId, categoryId) => {
  const questionsQuery = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const questionSnap = await getDocs(questionsQuery);
  const batch = writeBatch(db);
  questionSnap.docs.forEach((d) => batch.delete(d.ref));
  const catRef = doc(db, 'users', userId, 'categories', categoryId);
  batch.delete(catRef);
  await batch.commit();
};

export const getCategoryQuestionCount = async (userId, categoryId) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const snap = await getDocs(q);
  return snap.size;
};

// ─── Questions ───────────────────────────────────────────────────────────────

export const getQuestions = async (userId, filters = {}) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  let questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (filters.categoryId) questions = questions.filter((q) => q.categoryId === filters.categoryId);
  if (filters.status === 'mastered') questions = questions.filter((q) => q.mastered);
  else if (filters.status === 'in-progress') questions = questions.filter((q) => !q.mastered && q.practiceCount > 0);
  else if (filters.status === 'not-started') questions = questions.filter((q) => q.practiceCount === 0);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    questions = questions.filter(
      (q) => q.question.toLowerCase().includes(term) || q.idealAnswer?.toLowerCase().includes(term)
    );
  }
  return questions;
};

export const getQuestion = async (userId, questionId) => {
  const ref = doc(db, 'users', userId, 'questions', questionId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const addQuestion = async (userId, questionData) => {
  const ref = collection(db, 'users', userId, 'questions');
  const docRef = await addDoc(ref, {
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

export const addQuestions = async (userId, questionsData) => {
  const batch = writeBatch(db);
  const ids = [];
  questionsData.forEach((q) => {
    const ref = doc(collection(db, 'users', userId, 'questions'));
    batch.set(ref, {
      ...q,
      practiceCount: 0,
      mastered: false,
      source: q.source || 'ai-generated',
      voiceNoteLink: '',
      createdAt: serverTimestamp(),
      lastPracticedAt: null,
    });
    ids.push(ref.id);
  });
  await batch.commit();
  return ids;
};

export const updateQuestion = async (userId, questionId, updates) => {
  const ref = doc(db, 'users', userId, 'questions', questionId);
  await updateDoc(ref, updates);
};

export const deleteQuestion = async (userId, questionId) => {
  const ref = doc(db, 'users', userId, 'questions', questionId);
  await deleteDoc(ref);
};

export const incrementPracticeCount = async (userId, questionId, currentCount) => {
  if (currentCount >= 3) return currentCount;
  const ref = doc(db, 'users', userId, 'questions', questionId);
  const newCount = currentCount + 1;
  await updateDoc(ref, {
    practiceCount: newCount,
    mastered: newCount >= 3,
    lastPracticedAt: serverTimestamp(),
  });
  return newCount;
};

export const updateVoiceNoteLink = async (userId, questionId, link) => {
  const ref = doc(db, 'users', userId, 'questions', questionId);
  await updateDoc(ref, { voiceNoteLink: link });
};

// ─── Stats ───────────────────────────────────────────────────────────────────

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

export const getCategoryStats = async (userId, categoryId) => {
  const q = query(
    collection(db, 'users', userId, 'questions'),
    where('categoryId', '==', categoryId)
  );
  const snap = await getDocs(q);
  const questions = snap.docs.map((d) => d.data());
  return { total: questions.length, mastered: questions.filter((q) => q.mastered).length };
};

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
