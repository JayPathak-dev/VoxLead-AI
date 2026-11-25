"""Controlled appointment booking service with Asia/Kolkata timezone and double-booking prevention."""

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models import Appointment
from app.schemas import AppointmentCreate, AppointmentUpdate
from app.utils.validators import IST_ZONE, is_past_slot_ist, now_ist, parse_date_ist, parse_time_24h

DEFAULT_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"]


class BookingError(Exception):
    """Domain validation error for appointment scheduling."""


def _to_minutes(time_str: str) -> int:
    t = parse_time_24h(time_str)
    return t.hour * 60 + t.minute


def _slots_overlap(start_a: str, dur_a: int, start_b: str, dur_b: int) -> bool:
    a0 = _to_minutes(start_a)
    a1 = a0 + dur_a
    b0 = _to_minutes(start_b)
    b1 = b0 + dur_b
    return a0 < b1 and b0 < a1


def has_conflict(
    db: Session,
    scheduled_date: str,
    scheduled_time: str,
    duration_minutes: int = 30,
    resource_name: str = "Sales Specialist",
    exclude_appointment_id: Optional[int] = None,
) -> bool:
    """Return True if an active Confirmed appointment overlaps the requested slot."""
    query = db.query(Appointment).filter(
        Appointment.resource_name == resource_name,
        Appointment.scheduled_date == scheduled_date,
        Appointment.status == "Confirmed",
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    for existing in query.all():
        if _slots_overlap(scheduled_time, duration_minutes, existing.scheduled_time, existing.duration_minutes):
            return True
    return False


def get_available_slots(
    db: Session,
    target_date: Optional[str] = None,
    resource_name: str = "Sales Specialist",
    duration_minutes: int = 30,
) -> list[dict[str, str]]:
    """Return valid upcoming available slots in Asia/Kolkata for target_date or next 2 business days."""
    current_ist = now_ist()
    dates_to_check: list[str] = []

    if target_date:
        parsed = parse_date_ist(target_date)
        if parsed < current_ist.date():
            return []
        dates_to_check.append(parsed.strftime("%Y-%m-%d"))
    else:
        for offset in range(0, 4):
            d = current_ist.date() + timedelta(days=offset)
            # Skip Sunday (weekday 6)
            if d.weekday() == 6:
                continue
            dates_to_check.append(d.strftime("%Y-%m-%d"))
            if len(dates_to_check) >= 2:
                break

    available: list[dict[str, str]] = []
    for d_str in dates_to_check:
        for slot in DEFAULT_SLOTS:
            if is_past_slot_ist(d_str, slot):
                continue
            if not has_conflict(db, d_str, slot, duration_minutes, resource_name):
                available.append(
                    {
                        "date": d_str,
                        "time": slot,
                        "timezone": "Asia/Kolkata",
                        "label": f"{d_str} at {slot} IST",
                    }
                )
    return available


def _generate_code(db: Session, scheduled_date: str) -> str:
    compact = scheduled_date.replace("-", "")
    count = db.query(Appointment).filter(Appointment.scheduled_date == scheduled_date).count() + 1
    while True:
        code = f"APT-{compact}-{count:03d}"
        if not db.query(Appointment).filter(Appointment.appointment_code == code).first():
            return code
        count += 1


def create_appointment(db: Session, payload: AppointmentCreate) -> Appointment:
    """Validate slot, prevent past/overlapping bookings, and persist appointment in SQLite."""
    if not payload.confirmed_by_customer:
        raise BookingError("Explicit customer confirmation is required before booking an appointment.")

    # Validate date & time formats
    try:
        parse_date_ist(payload.scheduled_date)
        parse_time_24h(payload.scheduled_time)
    except ValueError as exc:
        raise BookingError("Invalid date or time format. Expected YYYY-MM-DD and HH:MM.") from exc

    if is_past_slot_ist(payload.scheduled_date, payload.scheduled_time):
        raise BookingError("Cannot book an appointment in the past (Asia/Kolkata).")

    # Idempotency check for duplicate submission in the same conversation
    if payload.conversation_id:
        existing_same = (
            db.query(Appointment)
            .filter(
                Appointment.conversation_id == payload.conversation_id,
                Appointment.scheduled_date == payload.scheduled_date,
                Appointment.scheduled_time == payload.scheduled_time,
                Appointment.status == "Confirmed",
            )
            .first()
        )
        if existing_same:
            return existing_same

    if has_conflict(
        db,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
        duration_minutes=payload.duration_minutes,
        resource_name=payload.resource_name,
    ):
        raise BookingError(
            f"Time slot {payload.scheduled_date} {payload.scheduled_time} IST is already booked for {payload.resource_name}."
        )

    appt = Appointment(
        appointment_code=_generate_code(db, payload.scheduled_date),
        lead_id=payload.lead_id,
        conversation_id=payload.conversation_id,
        customer_name=payload.customer_name.strip(),
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        company=payload.company,
        service_topic=payload.service_topic,
        resource_name=payload.resource_name,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
        duration_minutes=payload.duration_minutes,
        timezone="Asia/Kolkata",
        status="Confirmed",
        confirmed_by_customer=True,
        notes=payload.notes,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


def get_appointment(db: Session, appointment_id: int) -> Optional[Appointment]:
    """Retrieve appointment by ID."""
    return db.query(Appointment).filter(Appointment.id == appointment_id).first()


def update_appointment(db: Session, appointment_id: int, payload: AppointmentUpdate) -> Appointment:
    """Update an existing appointment while guarding against slot overlaps."""
    appt = get_appointment(db, appointment_id)
    if not appt:
        raise BookingError("Appointment not found.")

    new_date = payload.scheduled_date or appt.scheduled_date
    new_time = payload.scheduled_time or appt.scheduled_time
    new_dur = payload.duration_minutes or appt.duration_minutes
    new_status = payload.status or appt.status

    if (payload.scheduled_date or payload.scheduled_time or payload.duration_minutes) and new_status == "Confirmed":
        if is_past_slot_ist(new_date, new_time):
            raise BookingError("Cannot reschedule an appointment into the past (Asia/Kolkata).")
        if has_conflict(
            db,
            scheduled_date=new_date,
            scheduled_time=new_time,
            duration_minutes=new_dur,
            resource_name=appt.resource_name,
            exclude_appointment_id=appt.id,
        ):
            raise BookingError(f"Requested slot {new_date} {new_time} IST overlaps an existing booking.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)

    db.commit()
    db.refresh(appt)
    return appt


def cancel_appointment(db: Session, appointment_id: int) -> Appointment:
    """Cancel an appointment without deleting audit history."""
    appt = get_appointment(db, appointment_id)
    if not appt:
        raise BookingError("Appointment not found.")
    appt.status = "Cancelled"
    db.commit()
    db.refresh(appt)
    return appt
