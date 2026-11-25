"""SQLAlchemy database engine, session management, and initialization."""

from collections.abc import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()
db_url = settings.resolved_database_url

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

if db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base class for SQLAlchemy ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Yield a database session per FastAPI request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all database tables if they do not exist."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
