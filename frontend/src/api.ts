const API_BASE = `http://${window.location.hostname}:4000`;

export interface Document {
  _id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function checkHealth(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.status;
  } catch {
    return "unreachable";
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed.");
  return data as { token: string; email: string };
}

export async function signup(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed.");
  return data as { token: string; email: string };
}

export async function listDocuments(token: string): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/api/documents`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Couldn't load your documents.");
  return res.json();
}

export async function uploadDocument(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data;
}

export interface Conversation {
  _id: string;
  documentId: string | null;
  documentLabel: string;
  title: string | null;
  updatedAt: string;
}

export interface ConversationMessage {
  question: string;
  answer: string;
  createdAt: string;
}

export interface FullConversation extends Conversation {
  messages: ConversationMessage[];
}

export async function createConversation(token: string, documentId?: string): Promise<FullConversation> {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ documentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't start a new conversation.");
  return data;
}

export async function listConversations(token: string): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Couldn't load your conversations.");
  return res.json();
}

export async function getConversation(token: string, id: string): Promise<FullConversation> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Couldn't load that conversation.");
  return res.json();
}

export async function sendMessage(token: string, conversationId: string, question: string) {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't get an answer.");
  return data as { answer: string; truncated: boolean };
}

export function fileIconLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "TXT";
  return "FILE";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
