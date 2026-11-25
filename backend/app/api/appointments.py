"""Appointments CRUD and slot availability endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment
from app.schemas import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services import booking_service

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


@router.get("/slots/available")
def list_available_slots(
    date: Optional[str] = Query(default=None),
    duration_minutes: int = Query(default=30, ge=15, le=120),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        slots = booking_service.get_available_slots(
            db,
            target_date=date,
            duration_minutes=duration_minutes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date format (expected YYYY-MM-DD): {exc}") from exc
    return {"timezone": "Asia/Kolkata", "slots": slots}


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    search: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[Appointment]:
    query = db.query(Appointment)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Appointment.customer_name.ilike(term),
                Appointment.customer_email.ilike(term),
                Appointment.company.ilike(term),
                Appointment.appointment_code.ilike(term),
                Appointment.service_topic.ilike(term),
            )
        )
    if date:
        query = query.filter(Appointment.scheduled_date == date)
    if status_filter and status_filter != "All":
        query = query.filter(Appointment.status == status_filter)
    return query.order_by(Appointment.scheduled_date.asc(), Appointment.scheduled_time.asc()).all()


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment_endpoint(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
) -> Appointment:
    try:
        return booking_service.create_appointment(db, payload)
    except booking_service.BookingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment_endpoint(appointment_id: int, db: Session = Depends(get_db)) -> Appointment:
    appt = booking_service.get_appointment(db, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return appt


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment_endpoint(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
) -> Appointment:
    try:
        return booking_service.update_appointment(db, appointment_id, payload)
    except booking_service.BookingError as exc:
        code = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=code, detail=str(exc)) from exc


@router.delete("/{appointment_id}", status_code=status.HTTP_200_OK)
def cancel_or_delete_appointment(
    appointment_id: int,
    hard_delete: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    appt = booking_service.get_appointment(db, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if hard_delete:
        db.delete(appt)
        db.commit()
        return {"message": f"Appointment {appointment_id} deleted."}
    booking_service.cancel_appointment(db, appointment_id)
    return {"message": f"Appointment {appointment_id} cancelled."}
