"""Small SQLite JSON document store; each table stores contract-shaped records."""
import json, sqlite3
from .config import DB_PATH

def connect():
    c=sqlite3.connect(DB_PATH, check_same_thread=False); c.row_factory=sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    for table in ("orders","evidence","charges","decisions","alerts","insights","audit_log"):
        c.execute(f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
    c.commit(); return c
db=connect()
def all(table): return [json.loads(r[0]) for r in db.execute(f"SELECT data FROM {table}")]
def get(table, key):
    r=db.execute(f"SELECT data FROM {table} WHERE id=?",(key,)).fetchone(); return json.loads(r[0]) if r else None
def put(table, key, value):
    db.execute(f"INSERT OR REPLACE INTO {table}(id,data) VALUES(?,?)",(key,json.dumps(value))); db.commit(); return value
def delete_all(table): db.execute(f"DELETE FROM {table}"); db.commit()
