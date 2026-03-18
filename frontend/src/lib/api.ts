const BASE = "/api";

export interface Session {
  session_id: string;
  company: string;
  role: string;
  stage: string;
  mode: string;
  status: string;
  analysis: Record<string, unknown> | null;
  questions: Question[] | null;
  answers: Answer[] | null;
  current_question: CurrentQuestion | null;
  feedback: Feedback[] | null;
  summary: Record<string, unknown> | null;
  chat_history: { role: string; content: string; question_index?: number }[] | null;
  created_at: string;
}

export interface Question {
  question: string;
  category: string;
  why_asked: string;
}

export interface Answer {
  question: string;
  answer_framework: string;
  key_points: string[];
  example_to_use: string;
  avoid: string;
}

export interface CurrentQuestion {
  index: number;
  total: number;
  question: string;
  interviewer_says: string;
}

export interface Feedback {
  question: string;
  user_answer: string;
  score: number;
  strengths: string[];
  improvements: string[];
  improved_answer: string;
  tip: string;
}

export async function listSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function createSession(data: {
  company: string;
  role: string;
  job_description: string;
  job_url?: string;
  stage: string;
  resume: string;
  mode: string;
  interviewer_name?: string;
  interviewer_title?: string;
}): Promise<Session> {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function submitAnswer(
  id: string,
  answer: string
): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function startRoleplay(id: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}/start-roleplay`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function getResume(): Promise<string> {
  const res = await fetch(`${BASE}/profile/resume`);
  if (!res.ok) return "";
  const data = await res.json();
  return data.resume || "";
}

export async function saveResume(resume: string): Promise<void> {
  await fetch(`${BASE}/profile/resume`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume }),
  });
}
