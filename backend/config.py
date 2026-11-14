import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = Path(__file__).resolve().parent
load_dotenv(BACKEND / ".env")
def setting(name, default): return os.getenv(name, default)
DATABASE_URL = setting("DATABASE_URL", "sqlite:///./passcheck.db")
DB_PATH = DATABASE_URL.removeprefix("sqlite:///")
if not Path(DB_PATH).is_absolute(): DB_PATH = str(ROOT / DB_PATH)
WEBHOOK_SECRET = setting("WEBHOOK_SECRET", "dev-webhook-secret")
CAPTURE_KEY = setting("CAPTURE_KEY", "dev-capture-key")
MANAGER_PIN = setting("MANAGER_PIN", "4242")
NOTIFY_URL = setting("NOTIFY_URL", "http://localhost:3000/api/notify")
NOTIFY_KEY = setting("NOTIFY_KEY", "dev-notify-key")
DEMO_MODE = setting("DEMO_MODE", "true").lower() == "true"
FRAME_RETENTION_DAYS = int(setting("FRAME_RETENTION_DAYS", "30"))
STALE_THRESHOLD_S = int(setting("STALE_THRESHOLD_S", "180"))
