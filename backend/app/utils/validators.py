"""Input validation, filename sanitization, text cleaning, and timezone helpers."""

import os
import re
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}
IST_ZONE = ZoneInfo("Asia/Kolkata")


def sanitize_filename(filename: str) -> str:
    """Sanitize an uploaded filename to prevent path traversal and invalid characters."""
    base = os.path.basename(filename or "document.txt").strip()
    stem, ext = os.path.splitext(base)
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._-") or "document"
    safe_ext = ext.lower()
    if safe_ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{safe_ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    return f"{safe_stem[:100]}{safe_ext}"


def clean_text(text: str) -> str:
    """Clean extracted text for chunking and embedding without losing structure."""
    if not text:
        return ""
    text = text.replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def validate_email(email: str | None) -> str | None:
    """Validate basic email format if provided."""
    if not email:
        return None
    cleaned = email.strip()
    if re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", cleaned):
        return cleaned.lower()
    return None


def validate_phone(phone: str | None) -> str | None:
    """Normalize and validate phone numbers (7 to 16 digits)."""
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone.strip())
    pure_digits = re.sub(r"\D", "", digits)
    if 7 <= len(pure_digits) <= 15:
        return digits
    return None


def now_ist() -> datetime:
    """Return current datetime in Asia/Kolkata timezone."""
    return datetime.now(IST_ZONE)


def parse_date_ist(date_str: str) -> date:
    """Parse YYYY-MM-DD and ensure it is a valid calendar date."""
    return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()


def parse_time_24h(time_str: str) -> time:
    """Parse HH:MM 24-hour time string."""
    return datetime.strptime(time_str.strip(), "%H:%M").time()


def is_past_slot_ist(scheduled_date: str, scheduled_time: str) -> bool:
    """Return True if the date/time in Asia/Kolkata is in the past."""
    target_date = parse_date_ist(scheduled_date)
    target_time = parse_time_24h(scheduled_time)
    slot_dt = datetime.combine(target_date, target_time, tzinfo=IST_ZONE)
    return slot_dt <= now_ist()


def ensure_safe_path(base_dir: Path, target_path: Path) -> Path:
    """Verify target_path stays within base_dir."""
    resolved_base = base_dir.resolve()
    resolved_target = target_path.resolve()
    if resolved_base not in resolved_target.parents and resolved_base != resolved_target:
        raise ValueError("Unsafe file path detected.")
    return resolved_target
