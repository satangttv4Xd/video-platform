"""
Admin routes: user management + Google Drive sync/status.
All endpoints require an admin JWT.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.security import hash_password
from app.models.models import Document, GoogleToken, User, Video
from app.schemas.schemas import (
    DriveStatus,
    PasswordReset,
    SyncResult,
    UserCreate,
    UserOut,
)
from app.services import drive_service

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- User management ----------
@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'member'")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/reset-password", response_model=UserOut)
def reset_password(user_id: int, payload: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return user


# ---------- Google Drive ----------
@router.get("/drive/status", response_model=DriveStatus)
def drive_status(db: Session = Depends(get_db)):
    token = db.query(GoogleToken).first()
    if token is None:
        return DriveStatus(connected=False)
    return DriveStatus(
        connected=True,
        expires_at=token.expires_at,
        has_refresh_token=bool(token.refresh_token),
    )


@router.post("/drive/sync", response_model=SyncResult)
def drive_sync(db: Session = Depends(get_db)):
    """Read both Drive folders and upsert the file metadata into the DB."""
    try:
        videos = drive_service.list_videos(db)
        documents = drive_service.list_documents(db)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Google Drive error: {exc}")

    videos_added = 0
    for f in videos:
        existing = db.query(Video).filter(Video.drive_file_id == f["id"]).first()
        if existing:
            existing.title = f["name"]
            existing.filename = f["name"]
            existing.mime_type = f.get("mimeType")
            existing.size = int(f["size"]) if f.get("size") else None
            existing.thumbnail = f.get("thumbnailLink")
        else:
            db.add(
                Video(
                    drive_file_id=f["id"],
                    title=f["name"],
                    filename=f["name"],
                    mime_type=f.get("mimeType"),
                    size=int(f["size"]) if f.get("size") else None,
                    thumbnail=f.get("thumbnailLink"),
                )
            )
            videos_added += 1

    documents_added = 0
    for f in documents:
        existing = db.query(Document).filter(Document.drive_file_id == f["id"]).first()
        if existing:
            existing.title = f["name"]
            existing.filename = f["name"]
            existing.size = int(f["size"]) if f.get("size") else None
        else:
            db.add(
                Document(
                    drive_file_id=f["id"],
                    title=f["name"],
                    filename=f["name"],
                    size=int(f["size"]) if f.get("size") else None,
                )
            )
            documents_added += 1

    db.commit()

    return SyncResult(
        videos_added=videos_added,
        documents_added=documents_added,
        videos_total=db.query(Video).count(),
        documents_total=db.query(Document).count(),
    )
