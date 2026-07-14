"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    GOOGLE_DRIVE_FOLDER_VIDEO: str = ""
    GOOGLE_DRIVE_FOLDER_DOCUMENT: str = ""
    # Root shared folder that holds the course subfolders (CCNA Books, ...).
    # Falls back to the document folder id when left blank.
    GOOGLE_DRIVE_ROOT_FOLDER: str = ""

    # --- JWT ---
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # --- Database ---
    DATABASE_URL: str = "sqlite:///./app.db"

    # --- CORS ---
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # --- Default admin (created on first run if no users exist) ---
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin1234"


settings = Settings()
