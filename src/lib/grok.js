// Grok API integration for AI question generation
// Uses the xAI API with grok-3 model

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

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
6. Output ONLY valid JSON. No preamble, no markdown code fences.

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

let lastCallTime = 0;
const RATE_LIMIT_MS = 10000;

/**
 * Check if we're within the rate limit window
 */
export const isRateLimited = () => {
  return Date.now() - lastCallTime < RATE_LIMIT_MS;
};

/**
 * Get remaining cooldown time in seconds
 */
export const getRateLimitRemaining = () => {
  const remaining = RATE_LIMIT_MS - (Date.now() - lastCallTime);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

/**
 * Generate interview questions using Grok API
 * @param {string} topicTitle - Topic for question generation
 * @param {string} description - Additional context
 * @param {string} examType - Target exam
 * @param {string|null} documentText - Optional extracted document text
 * @returns {Promise<Array>} Array of {question, idealAnswer} objects
 */
export const generateQuestions = async (topicTitle, description, examType, documentText = null) => {
  const apiKey = import.meta.env.VITE_GROK_API_KEY;

  if (!apiKey || apiKey === 'your_grok_api_key_here') {
    throw new Error('MISSING_API_KEY');
  }

  if (isRateLimited()) {
    throw new Error(`RATE_LIMITED:${getRateLimitRemaining()}`);
  }

  const userPrompt = `
Topic: ${topicTitle}
Context: ${description}
Target exam: ${examType}
${documentText ? `Source material:\n${documentText}` : ''}

Generate targeted practice questions for this topic as per your instructions.
`.trim();

  lastCallTime = Date.now();

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API_ERROR:${response.status}:${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('EMPTY_RESPONSE');
  }

  try {
    // Strip markdown code fences if present
    const cleanedContent = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleanedContent);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response structure');
    }
    return parsed.questions;
  } catch {
    // Return raw content with a flag for the UI to handle
    throw new Error(`JSON_PARSE_ERROR:${content}`);
  }
};

// ─── Document Categorisation ──────────────────────────────────────────────────

const CATEGORISE_SYSTEM_PROMPT = `You are an expert interview preparation coach for IIT Jodhpur M.Des and M.Tech design entrance exams (M-test / studio test).

You will receive raw text extracted from a study document — it may be notes, a question bank, interview prep material, or general design content. Your job is to:

1. Read the full text carefully
2. Identify or derive practice interview questions from the content
3. Classify each question into exactly one of three categories:
   - "personal" — questions about the candidate's background, motivation, self-awareness, life experiences, goals
   - "case_study" — questions involving design challenges, problem-solving scenarios, product critique, redesign tasks, or real-world design problems
   - "technical" — questions about design theory, methods, tools, terminology, research processes, HCI concepts, XR, design systems, or domain knowledge

Rules:
- Generate between 4 and 6 questions per category (12–18 total)
- If the source material has very little content for a category, generate fewer but make them relevant to the document's context
- Questions must be specific and meaningful — not generic filler
- For each question, provide an ideal answer framework: key points, suggested structure, and one reference if relevant
- Output ONLY valid JSON. No preamble, no markdown fences, no explanation outside the JSON.

Output format:
{
  "personal": [
    { "question": "...", "idealAnswer": "..." }
  ],
  "case_study": [
    { "question": "...", "idealAnswer": "..." }
  ],
  "technical": [
    { "question": "...", "idealAnswer": "..." }
  ]
}`;

/**
 * Generate and categorise questions from an uploaded document.
 * Returns { personal: [], case_study: [], technical: [] }
 * @param {string} extractedText - Raw text extracted from the document
 * @param {string} examType - Target exam type
 */
export const generateAndCategoriseFromDocument = async (extractedText, examType) => {
  const apiKey = import.meta.env.VITE_GROK_API_KEY;

  if (!apiKey || apiKey === 'your_grok_api_key_here') {
    throw new Error('MISSING_API_KEY');
  }

  if (isRateLimited()) {
    throw new Error(`RATE_LIMITED:${getRateLimitRemaining()}`);
  }

  const userPrompt = `
Exam context: ${examType}
Source document text:
---
${extractedText.slice(0, 12000)}
---

Extract and categorise practice interview questions from this document.
`.trim();

  lastCallTime = Date.now();

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: CATEGORISE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API_ERROR:${response.status}:${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error('EMPTY_RESPONSE');

  try {
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.personal || !parsed.case_study || !parsed.technical) {
      throw new Error('Invalid categorisation response structure');
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
