"""
Google Drive integration service.

Responsibilities:
- Build OAuth flow / authorization URL.
- Persist and refresh credentials (stored in DB, single-row token table).
- List files in the Video and Document folders.
- Stream a file's bytes from Drive, forwarding HTTP Range requests so the
  browser can seek within videos.

The web user NEVER receives a Google Drive URL or file ID directly.
"""
from datetime import datetime, timezone
from typing import Iterator, Optional, Tuple

import httpx
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import GoogleToken

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

VIDEO_MIME_TYPES = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
}
PDF_MIME_TYPE = "application/pdf"
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


def folder_token(folder_id: str) -> str:
    """
    Opaque, signed reference to a Drive folder so the raw folder id is never
    exposed to (or forgeable by) the client. Deterministic for a given id.
    """
    return jwt.encode(
        {"fid": folder_id}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )


def folder_id_from_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload.get("fid")
    except JWTError:
        return None


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }


def build_authorization_url() -> Tuple[str, str]:
    """Return (authorization_url, state). Forces a refresh_token to be issued."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # ensures refresh_token every time
    )
    return auth_url, state


def exchange_code_and_store(db: Session, code: str) -> GoogleToken:
    """Exchange the OAuth authorization code for tokens and persist them."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    flow.fetch_token(code=code)
    creds = flow.credentials
    return _store_credentials(db, creds)


def _store_credentials(db: Session, creds: Credentials) -> GoogleToken:
    token = db.query(GoogleToken).first()
    if token is None:
        token = GoogleToken()
        db.add(token)
    token.access_token = creds.token
    # Keep the existing refresh_token if Google didn't send a new one
    if creds.refresh_token:
        token.refresh_token = creds.refresh_token
    token.token_uri = creds.token_uri
    token.expires_at = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else None
    db.commit()
    db.refresh(token)
    return token


def get_stored_token(db: Session) -> Optional[GoogleToken]:
    return db.query(GoogleToken).first()


def _load_credentials(db: Session) -> Credentials:
    token = get_stored_token(db)
    if token is None or not token.refresh_token:
        raise RuntimeError("Google Drive not connected. Admin must authorize first.")

    creds = Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri=token.token_uri or "https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
        # google-auth needs a naive UTC expiry to know when the token is stale.
        # Without it, creds.valid is always True and the token never refreshes.
        expiry=token.expires_at.replace(tzinfo=None) if token.expires_at else None,
    )
    # Refresh if expired (or if we don't know the expiry) using the refresh_token.
    if not creds.valid or creds.expiry is None:
        creds.refresh(GoogleRequest())
        _store_credentials(db, creds)
    return creds


def get_drive_service(db: Session):
    creds = _load_credentials(db)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _list_folder(service, folder_id: str, mime_filter: Optional[list[str]] = None) -> list[dict]:
    """List non-trashed files inside a folder. Handles pagination."""
    files: list[dict] = []
    page_token = None
    q = f"'{folder_id}' in parents and trashed = false"
    if mime_filter:
        mime_q = " or ".join([f"mimeType = '{m}'" for m in mime_filter])
        q += f" and ({mime_q})"
    while True:
        resp = (
            service.files()
            .list(
                q=q,
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, size, thumbnailLink, createdTime)",
                pageToken=page_token,
                pageSize=100,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def list_videos(db: Session) -> list[dict]:
    service = get_drive_service(db)
    return _list_folder(service, settings.GOOGLE_DRIVE_FOLDER_VIDEO, list(VIDEO_MIME_TYPES.keys()))


def list_documents(db: Session) -> list[dict]:
    service = get_drive_service(db)
    return _list_folder(service, settings.GOOGLE_DRIVE_FOLDER_DOCUMENT, [PDF_MIME_TYPE])


def root_folder_id() -> str:
    return settings.GOOGLE_DRIVE_ROOT_FOLDER or settings.GOOGLE_DRIVE_FOLDER_DOCUMENT


def list_child_folders(db: Session, folder_id: str) -> list[dict]:
    """List the immediate subfolders of a folder."""
    service = get_drive_service(db)
    folders = _list_folder(service, folder_id, [FOLDER_MIME_TYPE])
    return sorted(folders, key=lambda f: f["name"].lower())


def list_folder_files(db: Session, folder_id: str) -> list[dict]:
    """List the viewable files (PDF + video) directly inside a folder."""
    service = get_drive_service(db)
    mimes = list(VIDEO_MIME_TYPES.keys()) + [PDF_MIME_TYPE]
    files = _list_folder(service, folder_id, mimes)
    return sorted(files, key=lambda f: f["name"].lower())


def get_file_metadata(db: Session, file_id: str) -> dict:
    service = get_drive_service(db)
    return (
        service.files()
        .get(fileId=file_id, fields="id, name, mimeType, size", supportsAllDrives=True)
        .execute()
    )


def stream_file(
    db: Session, file_id: str, range_header: Optional[str] = None
) -> Tuple[Iterator[bytes], dict, int]:
    """
    Stream a Drive file's bytes, forwarding an optional Range header.

    Returns (byte_iterator, response_headers, status_code).
    The response_headers dict already contains Content-Type, Content-Length,
    Accept-Ranges, and (for partial responses) Content-Range.
    """
    creds = _load_credentials(db)
    access_token = creds.token

    download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"

    upstream_headers = {"Authorization": f"Bearer {access_token}"}
    if range_header:
        upstream_headers["Range"] = range_header

    client = httpx.Client(timeout=None)
    req = client.build_request("GET", download_url, headers=upstream_headers)
    upstream = client.send(req, stream=True)

    status_code = upstream.status_code  # 206 if ranged, 200 otherwise

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": upstream.headers.get("Content-Type", "application/octet-stream"),
    }
    if "Content-Length" in upstream.headers:
        resp_headers["Content-Length"] = upstream.headers["Content-Length"]
    if "Content-Range" in upstream.headers:
        resp_headers["Content-Range"] = upstream.headers["Content-Range"]

    def iterator() -> Iterator[bytes]:
        try:
            for chunk in upstream.iter_bytes(chunk_size=256 * 1024):
                yield chunk
        finally:
            upstream.close()
            client.close()

    return iterator(), resp_headers, status_code
