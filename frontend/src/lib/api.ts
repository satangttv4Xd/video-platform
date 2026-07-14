import type {
  AuthUser,
  FolderView,
  DashboardStats,
  DocumentItem,
  DriveStatus,
  ManagedUser,
  Role,
  SyncResult,
  Video,
} from "@/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STORAGE_KEY = "vlp_auth";

// ---------- auth persistence (sessionStorage) ----------
export function saveAuth(user: AuthUser) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function loadAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function clearAuth() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

// ---------- fetch helper ----------
async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- auth ----------
export async function login(
  username: string,
  password: string
): Promise<AuthUser> {
  const data = await request<{
    access_token: string;
    role: Role;
    username: string;
  }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return { username: data.username, role: data.role, token: data.access_token };
}

// ---------- content ----------
export const getDashboard = (token: string) =>
  request<DashboardStats>("/api/dashboard", {}, token);

export const getVideos = (token: string) =>
  request<Video[]>("/api/videos", {}, token);

export const getVideo = (id: number, token: string) =>
  request<Video>(`/api/videos/${id}`, {}, token);

export const getDocuments = (token: string) =>
  request<DocumentItem[]>("/api/documents", {}, token);

export const getCoursesRoot = (token: string) =>
  request<FolderView>("/api/courses", {}, token);

export const getFolder = (slug: string, token: string) =>
  request<FolderView>(`/api/courses/${encodeURIComponent(slug)}`, {}, token);

// Streaming URLs (used directly in <video> / <iframe>).
// The token is passed as a query param since media elements can't set headers.
export const videoStreamUrl = (id: number, token: string) =>
  `${API_URL}/api/video/${id}/stream?access_token=${encodeURIComponent(token)}`;

export const documentUrl = (id: number, token: string) =>
  `${API_URL}/api/document/${id}?access_token=${encodeURIComponent(token)}`;

// ---------- admin ----------
export const getUsers = (token: string) =>
  request<ManagedUser[]>("/api/admin/users", {}, token);

export const createUser = (
  payload: { username: string; password: string; role: Role },
  token: string
) =>
  request<ManagedUser>(
    "/api/admin/users",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );

export const deleteUser = (id: number, token: string) =>
  request<void>(`/api/admin/users/${id}`, { method: "DELETE" }, token);

export const resetPassword = (
  id: number,
  newPassword: string,
  token: string
) =>
  request<ManagedUser>(
    `/api/admin/users/${id}/reset-password`,
    { method: "POST", body: JSON.stringify({ new_password: newPassword }) },
    token
  );

export const getDriveStatus = (token: string) =>
  request<DriveStatus>("/api/admin/drive/status", {}, token);

export const syncDrive = (token: string) =>
  request<SyncResult>("/api/admin/drive/sync", { method: "POST" }, token);

export const getGoogleAuthUrl = (token: string) =>
  request<{ authorization_url: string }>("/api/auth/google", {}, token);
