"""
Pydantic schemas (request / response models).
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


# ---------- Users ----------
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "member"


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordReset(BaseModel):
    new_password: str


# ---------- Videos ----------
class VideoOut(BaseModel):
    id: int
    title: str
    filename: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    thumbnail: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Documents ----------
class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str
    size: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Courses (live Drive folder browsing) ----------
class FolderRef(BaseModel):
    slug: str               # opaque signed token; never the Drive folder id
    name: str


class CourseItemOut(BaseModel):
    id: int                 # our internal Video/Document id (never the Drive id)
    name: str
    type: str               # "video" | "pdf"
    size: Optional[int] = None


class FolderView(BaseModel):
    name: str
    slug: Optional[str] = None   # None for the root listing
    folders: list[FolderRef]
    items: list[CourseItemOut]


# ---------- Misc ----------
class SyncResult(BaseModel):
    videos_added: int
    documents_added: int
    videos_total: int
    documents_total: int


class DashboardStats(BaseModel):
    video_count: int
    document_count: int
    recent_videos: list[VideoOut]
    recent_documents: list[DocumentOut]


class DriveStatus(BaseModel):
    connected: bool
    expires_at: Optional[datetime] = None
    has_refresh_token: bool = False
