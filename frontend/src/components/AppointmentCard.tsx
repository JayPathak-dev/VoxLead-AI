import React from 'react';
import { Calendar, Clock, Building2, User, CheckCircle2, XCircle } from 'lucide-react';
import type { Appointment } from '../types';

export const AppointmentCard: React.FC<{
  appointment: Appointment;
  onEdit: (appt: Appointment) => void;
  onCancel: (appt: Appointment) => void;
}> = ({ appointment, onEdit, onCancel }) => {
  const statusStyles: Record<string, string> = {
    Confirmed: 'bg-[#DDF2E7] text-[#126E4A] border-[#BEE6D2]',
    Completed: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
    Cancelled: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
  };

  return (
    <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[#16865A]">
            {appointment.appointment_code}
          </span>
          <h3 className="mt-0.5 text-base font-semibold text-[#202923]">{appointment.service_topic}</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            statusStyles[appointment.status] || statusStyles.Confirmed
          }`}
        >
          {appointment.status === 'Cancelled' ? (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {appointment.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[#4B5850] sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-[#78847D]" aria-hidden="true" />
          <span className="font-medium text-[#202923]">{appointment.customer_name}</span>
        </div>
        {appointment.company && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-[#78847D]" aria-hidden="true" />
            <span>{appointment.company}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-[#16865A]" aria-hidden="true" />
          <span>{appointment.scheduled_date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[#16865A]" aria-hidden="true" />
          <span>
            {appointment.scheduled_time} IST ({appointment.duration_minutes} min)
          </span>
        </div>
      </div>

      {appointment.notes && (
        <p className="mt-3 rounded-xl bg-[#FAFAF7] px-3 py-2 text-xs text-[#78847D]">{appointment.notes}</p>
      )}

      {appointment.status !== 'Cancelled' && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#E7ECE7] pt-3">
          <button
            type="button"
            onClick={() => onEdit(appointment)}
            className="rounded-xl border border-[#E7ECE7] bg-white px-3 py-1.5 text-xs font-semibold text-[#202923] hover:bg-[#F3F6F1]"
          >
            Edit / Reschedule
          </button>
          <button
            type="button"
            onClick={() => onCancel(appointment)}
            className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
          >
            Cancel Appointment
          </button>
        </div>
      )}
    </div>
  );
};
