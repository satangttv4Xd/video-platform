"""
Authentication routes: user login + Google OAuth flow for Drive access.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_admin
from app.core.security import create_access_token, verify_password
from app.models.models import User
from app.schemas.schemas import LoginRequest, TokenResponse
from app.services import drive_service

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(subject=user.username, role=user.role)
    return TokenResponse(access_token=token, role=user.role, username=user.username)


# ---------- Google OAuth ----------
@router.get("/auth/google")
def auth_google(_: User = Depends(require_admin)):
    """
    Admin-only. Returns the Google authorization URL.
    The frontend should redirect the browser to this URL.
    """
    auth_url, _state = drive_service.build_authorization_url()
    return {"authorization_url": auth_url}


@router.get("/auth/google/callback")
def auth_google_callback(
    code: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    OAuth redirect target. Google calls this with ?code=...
    Exchanges the code for tokens, stores them, then bounces the browser
    back to the admin panel.
    """
    try:
        drive_service.exchange_code_and_store(db, code)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {exc}")
    return RedirectResponse(url=f"{settings.FRONTEND_ORIGIN}/admin?google=connected")
