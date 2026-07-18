import json
from pathlib import Path
from app.main import app
Path("docs/openapi.json").write_text(json.dumps(app.openapi(),indent=2),encoding="utf-8")
