"""
Content routes for authenticated users: dashboard stats, video library,
video streaming (with HTTP Range support), and PDF documents.

Note: we expose our OWN integer ids to the frontend, never Drive file ids.
Streaming/serving endpoints resolve the internal id -> drive_file_id server-side.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Document, User, Video
from app.schemas.schemas import (
    CourseItemOut,
    DashboardStats,
    DocumentOut,
    FolderRef,
    FolderView,
    VideoOut,
)
from app.services import drive_service

router = APIRouter(prefix="/api", tags=["content"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return DashboardStats(
        video_count=db.query(Video).count(),
        document_count=db.query(Document).count(),
        recent_videos=db.query(Video).order_by(Video.created_at.desc()).limit(5).all(),
        recent_documents=db.query(Document).order_by(Document.created_at.desc()).limit(5).all(),
    )


# ---------- Courses (live Drive folder browsing) ----------
def _upsert_file(db: Session, f: dict) -> CourseItemOut:
    """
    Ensure a Drive file exists in our DB (as Video or Document) and return an
    item referencing our internal id — the Drive id is never sent to the client.
    """
    mime = f.get("mimeType")
    size = int(f["size"]) if f.get("size") else None
    is_video = mime in drive_service.VIDEO_MIME_TYPES

    if is_video:
        obj = db.query(Video).filter(Video.drive_file_id == f["id"]).first()
        if obj is None:
            obj = Video(drive_file_id=f["id"], title=f["name"], filename=f["name"])
            db.add(obj)
        obj.title = obj.filename = f["name"]
        obj.mime_type = mime
        obj.size = size
        obj.thumbnail = f.get("thumbnailLink")
        db.flush()
        return CourseItemOut(id=obj.id, name=f["name"], type="video", size=size)

    obj = db.query(Document).filter(Document.drive_file_id == f["id"]).first()
    if obj is None:
        obj = Document(drive_file_id=f["id"], title=f["name"], filename=f["name"])
        db.add(obj)
    obj.title = obj.filename = f["name"]
    obj.size = size
    db.flush()
    return CourseItemOut(id=obj.id, name=f["name"], type="pdf", size=size)


def _folder_view(db: Session, folder_id: str, name: str, slug: str | None) -> FolderView:
    """Build a folder view: its subfolders + its viewable files."""
    child_folders = drive_service.list_child_folders(db, folder_id)
    files = drive_service.list_folder_files(db, folder_id)
    items = [_upsert_file(db, f) for f in files]
    db.commit()
    folders = [
        FolderRef(slug=drive_service.folder_token(cf["id"]), name=cf["name"])
        for cf in child_folders
    ]
    return FolderView(name=name, slug=slug, folders=folders, items=items)


@router.get("/courses", response_model=FolderView)
def courses_root(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Top-level listing: the course folders inside the root shared folder."""
    try:
        return _folder_view(db, drive_service.root_folder_id(), "คอร์สเรียน", None)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Google Drive error: {exc}")


@router.get("/courses/{slug}", response_model=FolderView)
def course_folder(slug: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Listing for a folder (or nested subfolder) referenced by its signed slug."""
    folder_id = drive_service.folder_id_from_token(slug)
    if not folder_id:
        raise HTTPException(status_code=404, detail="Folder not found")
    try:
        meta = drive_service.get_file_metadata(db, folder_id)
        return _folder_view(db, folder_id, meta.get("name", "โฟลเดอร์"), slug)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Google Drive error: {exc}")


# ---------- Videos ----------
@router.get("/videos", response_model=list[VideoOut])
def list_videos(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Video).order_by(Video.created_at.desc()).all()


@router.get("/videos/{video_id}", response_model=VideoOut)
def get_video(video_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.get("/video/{video_id}/stream")
def stream_video(
    video_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    range_header: str | None = Header(default=None, alias="Range"),
):
    """
    Stream a video from Google Drive through the backend.
    Forwards the browser's Range header so seeking / pause-resume works.
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    try:
        iterator, headers, status_code = drive_service.stream_file(
            db, video.drive_file_id, range_header
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Streaming error: {exc}")

    return StreamingResponse(
        iterator,
        status_code=status_code,
        headers=headers,
        media_type=headers.get("Content-Type", "video/mp4"),
    )


# ---------- Documents ----------
@router.get("/documents", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.get("/document/{document_id}")
def get_document(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    range_header: str | None = Header(default=None, alias="Range"),
):
    """Serve the PDF bytes inline so the frontend viewer can render it."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        iterator, headers, status_code = drive_service.stream_file(
            db, doc.drive_file_id, range_header
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Document error: {exc}")

    headers["Content-Disposition"] = f'inline; filename="{doc.filename}"'
    return StreamingResponse(
        iterator,
        status_code=status_code,
        headers=headers,
        media_type="application/pdf",
    )
