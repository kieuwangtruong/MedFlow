"""Compatibility entrypoint for Uvicorn.

The real unified application is defined in ``ai/main.py``. This wrapper keeps
the familiar ``uvicorn app.main:app`` command working from the ``ai`` folder.
"""

from main import app


__all__ = ["app"]
