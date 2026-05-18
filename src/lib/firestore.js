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
} from 'firebase/firestore';
import { db } from './firebase';

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
const DEFAULT_QUESTIONS = {
  personal: [
    {
      question: 'Tell me about yourself.',
      idealAnswer: 'Start with your academic background, then move to what drew you to design, and close with why IIT Jodhpur specifically. Keep it under 2 minutes. Avoid reciting your CV — narrate a journey. Reference one project or moment that was a turning point for you.',
    },
    {
      question: 'Why do you want to pursue M.Des / M.Tech at IIT Jodhpur specifically?',
      idealAnswer: 'Mention specific faculty research areas (e.g. XR Lab, Human-Centred Design, Sustainable Design). Show you have read about the department. Connect their research focus to your own interests. Do not say "IIT brand" — say what the programme uniquely offers.',
    },
    {
      question: 'Walk me through your portfolio. Which project are you most proud of and why?',
      idealAnswer: 'Pick one project, not all of them. Explain the problem, your design process (research → ideation → prototyping → testing), what you learned, and what you would do differently. Show process, not just the final output.',
    },
    {
      question: 'What are your strengths and weaknesses as a designer?',
      idealAnswer: 'Be specific — avoid generic answers like "I am a perfectionist." For strength, tie it to something demonstrable in your work. For weakness, name a real one and explain how you are actively working on it. Self-awareness matters more than the answer itself.',
    },
    {
      question: 'Where do you see yourself 5 years after completing this programme?',
      idealAnswer: 'Be honest but show ambition. Options: academic research, design practice, social impact design, entrepreneurship. Tie your answer back to the research you want to do during the programme. Vague answers like "I want to be a good designer" score poorly.',
    },
    {
      question: 'Why did you choose your undergraduate branch, and how does it connect to design?',
      idealAnswer: 'Do not apologise for a non-design background. Frame it as an advantage — engineering gives you systems thinking, science gives you rigour, humanities gives you empathy. Show one concrete example of how your background shaped your design thinking.',
    },
    {
      question: 'Have you taken any design courses, workshops, or certifications outside your degree?',
      idealAnswer: 'If yes, describe what you learned and apply it to a real project. If no, be honest and redirect to self-teaching, independent projects, or design books/blogs you follow (e.g. IDEO, NNGroup, Don Norman\'s work).',
    },
    {
      question: 'How do you handle feedback and criticism on your design work?',
      idealAnswer: 'Give a real example of receiving critical feedback. Describe how you processed it, what you changed, and what the outcome was. Avoid saying "I always welcome feedback" without evidence.',
    },
  ],
  case_study: [
    {
      question: 'Redesign the experience of standing in a queue at a government office in India.',
      idealAnswer: 'Frame the problem first (who are the users, what are the pain points — time, uncertainty, dignity). Use design thinking: empathise → define → ideate → prototype → test. Consider both digital and physical touchpoints. Mention edge cases: users without smartphones, language barriers, elderly users. Conclude with a testable solution, not a perfect one.',
    },
    {
      question: 'Design an assistive tool for visually impaired students in a classroom.',
      idealAnswer: 'Start with user research questions you would ask. Define the key needs: access to visual content, social inclusion, independence. Explore multiple solution directions before converging. Consider cost, scalability, and existing tools (e.g. NVDA, Be My Eyes). Acknowledge what you do not know and how you would test.',
    },
    {
      question: 'How would you improve the public transportation experience in a Tier-2 Indian city?',
      idealAnswer: 'Identify the specific pain points (unreliable schedules, poor information systems, safety for women, last-mile connectivity). Prioritise by impact vs feasibility. Propose one focused intervention rather than a sweeping overhaul. Reference real examples from other cities if possible (Pune, Indore, Surat).',
    },
    {
      question: 'You are given 24 hours and a team of 3 to design a solution for food waste in college canteens. Walk me through your process.',
      idealAnswer: 'Show time management awareness — research (2h), define (1h), ideate (4h), prototype (10h), test and iterate (7h). Assign roles. Be specific about what a prototype looks like in 24h (paper, digital mockup, roleplay). Acknowledge what would need more time in the real world.',
    },
    {
      question: 'A local NGO wants to use technology to improve literacy in rural Rajasthan. How would you approach this design challenge?',
      idealAnswer: 'Begin with context: low connectivity, multilingual users, low tech literacy. Avoid assuming a smartphone app is the answer. Consider feature phones, community radio, IVR, offline-first tools. Reference existing programmes (Pratham, Khan Academy Lite). Show cultural sensitivity — solutions must fit local context.',
    },
    {
      question: 'Critique an everyday product (e.g. a water bottle, a bus ticket, or a public signage system).',
      idealAnswer: 'Use a structured critique framework: Who is the user? What is the task? Does the form follow the function? What are the affordances and signifiers? What fails and why? What would you change and why? Show you can separate aesthetic preference from functional critique.',
    },
    {
      question: 'How would you design an experience for senior citizens to adopt UPI payments?',
      idealAnswer: 'Identify barriers: low digital literacy, fear of fraud, small text, complex flows. Propose solutions at multiple levels: UI (larger text, voice guidance), UX (fewer steps, confirmations), ecosystem (trusted intermediary, community learning). Reference inclusive design principles.',
    },
  ],
  technical: [
    {
      question: 'What is Human-Centred Design (HCD) and how does it differ from user-centred design?',
      idealAnswer: 'HCD is broader — it considers all humans affected by a design, not just direct users (e.g. factory workers, community members). UCD focuses on the end user\'s needs and usability. Reference Don Norman\'s framing in "Design of Everyday Things." Give an example where the distinction matters.',
    },
    {
      question: 'Explain the double diamond design process.',
      idealAnswer: 'Two diamonds representing diverge → converge, done twice. First diamond: Discover (research, observe) → Define (synthesise insights into a problem statement). Second diamond: Develop (ideate, prototype) → Deliver (test, refine, ship). Key insight: the process is not linear — you loop back. Developed by the British Design Council in 2005.',
    },
    {
      question: 'What is XR (Extended Reality) and what are its subcategories?',
      idealAnswer: 'XR is an umbrella term for all real-and-virtual-combined environments. Subcategories: AR (overlays digital on real world), VR (fully immersive digital environment), MR (digital and physical interact). Applications in design: prototyping spaces, accessibility, training simulations, cultural heritage.',
    },
    {
      question: 'What is the difference between UI and UX?',
      idealAnswer: 'UI (User Interface) is what you see and touch — buttons, typography, colour, layout. UX (User Experience) is the entire journey — how the user feels, whether the product solves their problem, and how easy it is to use. Good UI with bad UX: a beautiful app that is confusing. They are complementary, not interchangeable.',
    },
    {
      question: 'What is Design Thinking and how is it different from traditional problem-solving?',
      idealAnswer: 'Design thinking is human-centred, iterative, and comfortable with ambiguity. Traditional problem-solving is often linear, solution-first, and assumption-heavy. Design thinking stages: Empathise → Define → Ideate → Prototype → Test. Key difference: you spend more time on the problem before jumping to solutions. Reference IDEO, Stanford d.school.',
    },
    {
      question: 'What is a design system and why does it matter?',
      idealAnswer: 'A design system is a collection of reusable components, guidelines, and principles that ensure consistency across a product. Examples: Google Material Design, Apple Human Interface Guidelines, IBM Carbon. It matters because it speeds up design and development, ensures consistency, reduces decision fatigue, and scales across teams.',
    },
    {
      question: "What is Fitt's Law and how does it apply to interface design?",
      idealAnswer: "Fitt's Law states that the time to move to a target is a function of distance and size — closer and larger targets are faster to click. Application: make primary action buttons large and close to where the user's cursor/finger naturally rests. Examples: the macOS Dock, floating action buttons in mobile apps.",
    },
    {
      question: 'Explain the concept of affordances and give two examples from everyday objects.',
      idealAnswer: 'An affordance is a property of an object that suggests how it should be used. Term coined by James Gibson, popularised by Don Norman. Examples: a door handle affords pulling; a flat door plate affords pushing. In digital UI: a raised button affords clicking; underlined blue text affords linking.',
    },
    {
      question: 'What is the difference between qualitative and quantitative research in design?',
      idealAnswer: 'Qualitative: non-numerical, exploratory — interviews, ethnography, diary studies. Tells you *why* and *how*. Quantitative: numerical, measurable — surveys, analytics, A/B tests. Tells you *what* and *how many*. Good design research uses both: qualitative to discover the problem, quantitative to validate the solution.',
    },
    {
      question: 'What tools do you use for design and prototyping, and why?',
      idealAnswer: 'Name tools you genuinely use (Figma, Adobe XD, Sketch, Framer, Miro, etc.) and explain *why* each is appropriate for what type of work. Do not name tools you have only heard of. If your toolkit is limited, be honest and show curiosity about what you are learning.',
    },
  ],
};

// ─── User ────────────────────────────────────────────────────────────────────

/**
 * Initialize a new user's Firestore document with defaults + seeded questions
 */
export const initUserData = async (userId, userData) => {
  const userRef = doc(db, 'users', userId);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    const batch = writeBatch(db);

    // Create user document
    batch.set(userRef, {
      name: userData.displayName || '',
      email: userData.email || '',
      createdAt: serverTimestamp(),
      examConfig: {
        examType: 'IIT Jodhpur M.Des / M.Tech',
        targetYear: new Date().getFullYear().toString(),
      },
      firstLoginBannerDismissed: false,
    });

    // Create 3 default categories and collect their refs
    const catRefs = {};
    DEFAULT_CATEGORIES.forEach((cat) => {
      const ref = doc(collection(db, 'users', userId, 'categories'));
      catRefs[cat.name] = ref;
      batch.set(ref, {
        name: cat.name,
        order: cat.order,
        color: cat.color,
        createdAt: serverTimestamp(),
      });
    });

    // Seed questions for each category
    const questionEntries = [
      { key: 'personal',    catName: 'Personal Questions'  },
      { key: 'case_study',  catName: 'Case Study Questions' },
      { key: 'technical',   catName: 'Technical Questions'  },
    ];

    questionEntries.forEach(({ key, catName }) => {
      const categoryRef = catRefs[catName];
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
  const catRef = collection(db, 'users', userId, 'categories');
  const docRef = await addDoc(catRef, {
    name,
    order: existingCount,
    color: CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length],
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
