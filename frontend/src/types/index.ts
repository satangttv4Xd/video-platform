export type Role = "admin" | "member";

export interface AuthUser {
  username: string;
  role: Role;
  token: string;
}

export interface Video {
  id: number;
  title: string;
  filename: string;
  mime_type?: string | null;
  size?: number | null;
  thumbnail?: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  title: string;
  filename: string;
  size?: number | null;
  created_at: string;
}

export interface DashboardStats {
  video_count: number;
  document_count: number;
  recent_videos: Video[];
  recent_documents: DocumentItem[];
}

export interface FolderRef {
  slug: string;
  name: string;
}

export interface CourseItem {
  id: number;
  name: string;
  type: "video" | "pdf";
  size?: number | null;
}

export interface FolderView {
  name: string;
  slug: string | null;
  folders: FolderRef[];
  items: CourseItem[];
}

export interface ManagedUser {
  id: number;
  username: string;
  role: Role;
  created_at: string;
}

export interface DriveStatus {
  connected: boolean;
  expires_at?: string | null;
  has_refresh_token: boolean;
}

export interface SyncResult {
  videos_added: number;
  documents_added: number;
  videos_total: number;
  documents_total: number;
}
