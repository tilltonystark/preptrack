// AI question generation — powered by Google Gemini 1.5 Flash (free tier)
// Drop-in replacement for the previous Grok integration.
// All exported function signatures are identical — no other files need changes.

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── System Prompts ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert interview coach specialising in IIT Jodhpur M.Des and M.Tech design entrance exams (commonly called the M-test or studio test). You have deep knowledge of:

- The IIT Jodhpur design department's academic focus: interaction design, XR (extended reality), human-computer interaction, sustainable design, and design research
- The typical interview panel structure: faculty interviews, portfolio reviews, and sometimes a studio/design task
- What IIT Jodhpur faculty look for: critical thinking, design awareness, research aptitude, articulate communication, and passion for interdisciplinary design
- Common question patterns: personal motivation questions, design thinking scenarios, opinion-based questions on design in society, portfolio discussion, and emerging tech (especially XR/AR/VR)
- How strong answers are typically framed: specific and personal (not generic), backed by examples or references, showing design process awareness, demonstrating awareness of India's design ecosystem

When generating questions:
1. Make them SPECIFIC to the topic provided — not generic interview questions
2. Anticipate what an IIT Jodhpur faculty member would genuinely want to understand
3. For each question, provide an ideal answer FRAMEWORK — not a word-for-word script, but key points, a suggested structure, and 1–2 example references the candidate could use
4. Frame answers in a way that is confident but not arrogant, specific but conversational
5. Vary question types: some factual, some opinion-based, some scenario/case-based
6. Output ONLY valid JSON. No preamble, no markdown code fences, no explanation.

Output format:
{
  "questions": [
    {
      "question": "...",
      "idealAnswer": "Key points: ... | Structure: ... | Example references: ..."
    }
  ]
}

Generate between 5 and 8 questions unless specified otherwise.`;

const CATEGORISE_SYSTEM_PROMPT = `You are an expert interview preparation coach for IIT Jodhpur M.Des and M.Tech design entrance exams (M-test / studio test).

You will receive raw text extracted from a study document. Your job is to:
1. Read the full text carefully
2. Identify or derive practice interview questions from the content
3. Classify each question into exactly one of three categories:
   - "personal" — questions about background, motivation, self-awareness, life experiences, goals
   - "case_study" — design challenges, problem-solving scenarios, product critique, redesign tasks
   - "technical" — design theory, methods, tools, HCI concepts, XR, design systems, domain knowledge

Rules:
- Generate between 4 and 6 questions per category (12–18 total)
- Questions must be specific and meaningful — not generic filler
- For each question, provide an ideal answer framework
- Output ONLY valid JSON. No preamble, no markdown, no explanation outside the JSON.

Output format:
{
  "personal": [{ "question": "...", "idealAnswer": "..." }],
  "case_study": [{ "question": "...", "idealAnswer": "..." }],
  "technical": [{ "question": "...", "idealAnswer": "..." }]
}`;

// ─── Rate Limiting ────────────────────────────────────────────────────────────

let lastCallTime = 0;
const RATE_LIMIT_MS = 5000; // Gemini free tier: 15 req/min — 5s cooldown is safe

export const isRateLimited = () => Date.now() - lastCallTime < RATE_LIMIT_MS;
export const getRateLimitRemaining = () => {
  const remaining = RATE_LIMIT_MS - (Date.now() - lastCallTime);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

const callGemini = async (systemPrompt, userPrompt, maxTokens = 3000) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('MISSING_API_KEY');
  }

  if (isRateLimited()) {
    throw new Error(`RATE_LIMITED:${getRateLimitRemaining()}`);
  }

  lastCallTime = Date.now();

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json', // forces clean JSON, no markdown fences
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData?.error?.message || 'Unknown error';
    throw new Error(`API_ERROR:${response.status}:${msg}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) throw new Error('EMPTY_RESPONSE');

  return content;
};

// ─── Parse helper ─────────────────────────────────────────────────────────────

const parseJSON = (content) => {
  // Strip any accidental markdown fences (responseMimeType should prevent this)
  const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
};

// ─── generateQuestions ────────────────────────────────────────────────────────

/**
 * Generate interview questions using Gemini.
 * @param {string} topicTitle
 * @param {string} description
 * @param {string} examType
 * @param {string|null} documentText
 * @returns {Promise<Array>} Array of {question, idealAnswer}
 */
export const generateQuestions = async (topicTitle, description, examType, documentText = null) => {
  const userPrompt = `
Topic: ${topicTitle}
Context: ${description}
Target exam: ${examType}
${documentText ? `Source material:\n${documentText}` : ''}

Generate targeted practice questions for this topic as per your instructions.
`.trim();

  const content = await callGemini(SYSTEM_PROMPT, userPrompt, 3000);

  try {
    const parsed = parseJSON(content);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response structure');
    }
    return parsed.questions;
  } catch {
    throw new Error(`JSON_PARSE_ERROR:${content}`);
  }
};

// ─── generateAndCategoriseFromDocument ───────────────────────────────────────

/**
 * Generate and categorise questions from an uploaded document.
 * @param {string} extractedText
 * @param {string} examType
 * @returns {Promise<{personal: [], case_study: [], technical: []}>}
 */
export const generateAndCategoriseFromDocument = async (extractedText, examType) => {
  const userPrompt = `
Exam context: ${examType}
Source document text:
---
${extractedText.slice(0, 12000)}
---

Extract and categorise practice interview questions from this document.
`.trim();

  const content = await callGemini(CATEGORISE_SYSTEM_PROMPT, userPrompt, 4000);

  try {
    const parsed = parseJSON(content);
    if (!parsed.personal || !parsed.case_study || !parsed.technical) {
      throw new Error('Invalid categorisation structure');
    }
    return {
      personal:   Array.isArray(parsed.personal)   ? parsed.personal   : [],
      case_study: Array.isArray(parsed.case_study) ? parsed.case_study : [],
      technical:  Array.isArray(parsed.technical)  ? parsed.technical  : [],
    };
  } catch {
    throw new Error(`JSON_PARSE_ERROR:${content}`);
  }
};
