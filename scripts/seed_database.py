"""CLI script to seed demo CRM records into VoxLead AI SQLite database."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, init_db
from app.services.demo_seed_service import seed_demo_data


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        result = seed_demo_data(db)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
