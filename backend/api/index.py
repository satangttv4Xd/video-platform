"""
Vercel serverless entrypoint.

Vercel's @vercel/python builder serves the ASGI `app` object exported here.
The `app/` package lives one level up (the deployment root = backend/), so we
add that root to sys.path before importing the FastAPI application.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402

# Vercel looks for a module-level `app` (ASGI) — nothing else needed.
