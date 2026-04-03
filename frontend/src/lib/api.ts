import { supabase } from "./supabase";

/** Production: set VITE_API_ORIGIN to Railway public URL (no trailing slash), e.g. https://xxx.up.railway.app */
function apiBase(): string {
  const origin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (origin) {
    return `${origin.replace(/\/$/, "")}/api`;
  }
  return "/api";
}

const BASE = apiBase();

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const ah = await authHeaders();
  const headers = { ...ah, ...(init?.headers || {}) };
  return fetch(input, { ...init, headers });
}

/**
 * Main data model returned by all session endpoints.
 * Represents an interview prep or roleplay session with its state and generated content.
 */
export interface Session {
  /** Unique session identifier */
  session_id: string;
  /** Company name from JD or user input */
  company: string;
  /** Job role/title */
  role: string;
  /** Interview stage (e.g., phone, onsite, final) */
  stage: string;
  /** Session mode: "prep" or "roleplay" */
  mode: string;
  /** Current status (e.g., generating, ready, paused, finished) */
  status: string;
  /** Resume/JD analysis output, or null if not yet generated */
  analysis: Record<string, unknown> | null;
  /** Generated interview questions, or null if not yet generated */
  questions: Question[] | null;
  /** Drafted answer frameworks with coaching, or null if not yet generated */
  answers: Answer[] | null;
  /** Active question in roleplay mode; null when not in roleplay or between questions */
  current_question: CurrentQuestion | null;
  /** Evaluations of user roleplay answers; populated after each answer is scored */
  feedback: Feedback[] | null;
  /** Session summary; populated when roleplay finishes */
  summary: Record<string, unknown> | null;
  /** Chat messages for prep mode Q&A; includes optional question_index for context */
  chat_history: { role: string; content: string; question_index?: number }[] | null;
  /** ISO 8601 timestamp when session was created */
  created_at: string;
  /** Dashboard grouping key (defaults to normalized company) */
  pipeline_group?: string;
  /** Raw sum/count per competency key during role-play */
  running_competency_scores?: Record<string, { sum: number; count: number }>;
  /** Running average 1–10 per competency key (this session) */
  skill_averages?: Record<string, number>;
}

/**
 * A generated interview question with metadata for prep and roleplay.
 */
export interface Question {
  /** The question text */
  question: string;
  /** Question category (e.g., behavioral, technical) */
  category: string;
  /** Underlying theme or competency being assessed */
  theme: string;
  /** Why the interviewer might ask this question */
  why_asked: string;
  /** Optional role/title of likely asker (e.g., hiring manager, recruiter) */
  likely_asked_by?: string;
}

/**
 * A drafted answer framework with coaching details for a question.
 */
export interface Answer {
  /** The question this answer addresses */
  question: string;
  /** Suggested structure and talking points for the answer */
  answer_framework: string;
  /** Key points to cover */
  key_points: string[];
  /** Example or story to use from resume/experience */
  example_to_use: string;
  /** What to avoid saying or doing */
  avoid: string;
  /** Optional guidance on answer length or pacing */
  timing_guidance?: string;
  /** Optional red flags to avoid */
  red_flags?: string[];
  /** Optional high-level strategy for responding */
  response_strategy?: string;
}

/**
 * The active question in roleplay mode, with position and interviewer prompt.
 */
export interface CurrentQuestion {
  /** 0-based index of current question */
  index: number;
  /** Total number of questions in the roleplay */
  total: number;
  /** The question text */
  question: string;
  /** Full prompt the interviewer says (may include setup or follow-up) */
  interviewer_says: string;
}

/**
 * Evaluation of a user's roleplay answer.
 */
export interface Feedback {
  /** The question that was answered */
  question: string;
  /** The user's submitted answer text */
  user_answer: string;
  /** Numeric score (typically 0–100 or similar scale) */
  score: number;
  /** What the user did well */
  strengths: string[];
  /** Suggested improvements */
  improvements: string[];
  /** Model-generated improved version of the answer */
  improved_answer: string;
  /** Coaching tip for future answers */
  tip: string;
  /** Per scorecard-dimension scores for this answer (keys match analysis.scorecard_dimensions) */
  competency_scores?: Record<string, number>;
}

/**
 * Name and title for a panel interviewer.
 */
export interface InterviewerInfo {
  /** Interviewer's name */
  name: string;
  /** Job title or role (e.g., Hiring Manager, Recruiter) */
  title: string;
}

/**
 * Auto-extracted fields from a job description (text or URL).
 */
export interface ExtractedFields {
  /** Extracted company name */
  company: string;
  /** Extracted job role/title */
  role: string;
  /** Suggested interview stage based on JD */
  stage_suggestion: string;
  /** Full or cleaned job description text */
  job_description: string;
}

/**
 * Uploads a resume file (PDF or DOCX) and returns extracted plain text.
 *
 * @param file - Resume file to parse (PDF or DOCX)
 * @returns Extracted text content from the resume
 * @throws Error when upload fails or parsing returns an error
 */
export async function parseResumeFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${BASE}/parse-resume`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Failed: ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

/**
 * Sends job description text or URL to the backend and returns extracted company, role, and stage.
 *
 * @param data - Either job_description (raw text) or job_url; at least one required
 * @returns Extracted company, role, stage suggestion, and job description text
 * @throws Error when the request fails
 */
export async function extractFields(data: {
  job_description?: string;
  job_url?: string;
}): Promise<ExtractedFields> {
  const res = await apiFetch(`${BASE}/extract-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Performs a web search to find an interviewer's job title at a given company.
 *
 * @param name - Interviewer's name
 * @param company - Company name for context
 * @returns Object with title and source of the lookup
 * @throws Error when the request fails
 */
export async function lookupInterviewer(
  name: string,
  company: string
): Promise<{ title: string; source: string }> {
  const res = await apiFetch(`${BASE}/lookup-interviewer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, company }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Fetches all sessions from the backend.
 *
 * @returns Array of all sessions
 * @throws Error when the request fails
 */
export async function listSessions(): Promise<Session[]> {
  const res = await apiFetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Failed: ${res.status}`);
  }
}

/**
 * Creates a new session (blocking). Waits for full generation before returning.
 *
 * @param data - Session config: company, role, job_description, stage, resume, mode; optional job_url and interviewers
 * @returns The created session with questions and answers populated
 * @throws Error when the request fails
 */
export async function createSession(data: {
  company: string;
  role: string;
  job_description: string;
  job_url?: string;
  stage: string;
  resume: string;
  mode: string;
  interviewers?: InterviewerInfo[];
  pipeline_group?: string;
}): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Creates a session with SSE progress events. Calls onProgress for each completed graph node.
 *
 * @param data - Session config: company, role, job_description, stage, resume, mode; optional job_url and interviewers
 * @param onProgress - Callback invoked per completed node with node name and session ID
 * @returns The final session when done, or null if stream ends without a session payload
 * @throws Error when the request fails or the stream reports an error
 */
export async function createSessionStream(
  data: {
    company: string;
    role: string;
    job_description: string;
    job_url?: string;
    stage: string;
    resume: string;
    mode: string;
    interviewers?: InterviewerInfo[];
    pipeline_group?: string;
  },
  onProgress: (node: string, sessionId: string) => void
): Promise<Session | null> {
  const res = await apiFetch(`${BASE}/sessions/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || `Failed: ${res.status}`;
    const err = new Error(detail);
    (err as any).status = res.status;
    throw err;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let session: Session | null = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.done) {
          if (payload.error) throw new Error(payload.error);
          session = payload.session;
        } else {
          onProgress(payload.node, payload.session_id);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return session;
}

/**
 * Fetches a single session by ID.
 *
 * @param id - Session ID
 * @returns The session
 * @throws Error when the request fails
 */
export async function getSession(id: string): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Submits the user's roleplay answer and resumes the graph into the evaluate node.
 *
 * @param id - Session ID
 * @param answer - User's answer text
 * @returns Updated session with feedback for the submitted answer
 * @throws Error when the request fails
 */
export async function submitAnswer(
  id: string,
  answer: string
): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Advances past the feedback pause to the next question in roleplay.
 *
 * @param id - Session ID
 * @returns Updated session with next current_question
 * @throws Error when the request fails
 */
export async function continueSession(id: string): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions/${id}/continue`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Ends roleplay early and triggers session summary generation.
 *
 * @param id - Session ID
 * @returns Updated session with summary populated
 * @throws Error when the request fails
 */
export async function finishSession(id: string): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions/${id}/finish`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Switches a prep session to roleplay mode.
 *
 * @param id - Session ID
 * @returns Updated session with mode "roleplay" and first current_question
 * @throws Error when the request fails
 */
export async function startRoleplay(id: string): Promise<Session> {
  const res = await apiFetch(`${BASE}/sessions/${id}/start-roleplay`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/**
 * Loads the saved resume from the backend.
 *
 * @returns Resume text, or empty string if none saved or request fails
 */
export async function getResume(): Promise<string> {
  const res = await apiFetch(`${BASE}/profile/resume`);
  if (!res.ok) return "";
  const data = await res.json();
  return data.resume || "";
}

/**
 * Persists resume text to the backend.
 *
 * @param resume - Resume text to save
 */
export async function saveResume(resume: string): Promise<void> {
  await apiFetch(`${BASE}/profile/resume`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume }),
  });
}

export interface ProgressData {
  sessions_completed: number;
  total_questions: number;
  competency_averages: Record<string, number>;
  score_trend: { date: string; score: number }[];
  strongest: string | null;
  weakest: string | null;
}

export async function getProgress(): Promise<ProgressData> {
  const res = await apiFetch(`${BASE}/profile/progress`);
  if (!res.ok)
    return {
      sessions_completed: 0,
      total_questions: 0,
      competency_averages: {},
      score_trend: [],
      strongest: null,
      weakest: null,
    };
  return res.json();
}

export interface UserProfile {
  user_id: string | null;
  plan: string;
  session_count: number;
  authenticated: boolean;
  daily_sessions_used: number;
  daily_limit: number | null;
}

export async function getProfile(): Promise<UserProfile> {
  const res = await apiFetch(`${BASE}/profile/me`);
  if (!res.ok)
    return {
      user_id: null,
      plan: "free",
      session_count: 0,
      authenticated: false,
      daily_sessions_used: 0,
      daily_limit: 2,
    };
  return res.json();
}
