"""
SQLAlchemy engine, session factory, and Base.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Normalize legacy "postgres://" scheme (e.g. from Neon/Heroku) that SQLAlchemy
# 2.0 no longer accepts; it expects "postgresql://".
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

# check_same_thread is required for SQLite + FastAPI threads
connect_args = {"check_same_thread": False} if is_sqlite else {}

# pool_pre_ping recycles dead connections — needed for serverless Postgres
# (Neon) which drops idle connections behind the scenes.
engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
