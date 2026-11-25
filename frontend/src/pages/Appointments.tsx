import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarPlus, Search, X } from 'lucide-react';
import { api } from '../services/api';
import type { Appointment, AvailableSlot } from '../types';
import { Header } from '../components/Header';
import { AppointmentCard } from '../components/AppointmentCard';
import { LoadingState } from '../components/LoadingState';

export const Appointments: React.FC<{
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}> = ({ onToast }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [editing, setEditing] = useState<Partial<Appointment> & { confirmed_by_customer?: boolean } | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listAppointments({
        search: search || undefined,
        date: dateFilter || undefined,
      });
      setAppointments(data);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [search, dateFilter, onToast]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const loadSlots = async (targetDate?: string) => {
    try {
      const res = await api.getAvailableSlots(targetDate || undefined);
      setSlots(res.slots);
    } catch {
      setSlots([]);
    }
  };

  const openCreateModal = async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    setEditing({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      company: '',
      service_topic: 'AI Sales Discovery Call',
      scheduled_date: tomorrow,
      scheduled_time: '11:00',
      duration_minutes: 30,
      confirmed_by_customer: true,
      notes: '',
    });
    await loadSlots(tomorrow);
    dialogRef.current?.showModal();
  };

  const openEditModal = async (appt: Appointment) => {
    setEditing({ ...appt, confirmed_by_customer: true });
    await loadSlots(appt.scheduled_date);
    dialogRef.current?.showModal();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      if (editing.id) {
        await api.updateAppointment(editing.id, {
          customer_name: editing.customer_name,
          customer_email: editing.customer_email,
          customer_phone: editing.customer_phone,
          company: editing.company,
          service_topic: editing.service_topic,
          scheduled_date: editing.scheduled_date,
          scheduled_time: editing.scheduled_time,
          duration_minutes: editing.duration_minutes,
          status: editing.status,
          notes: editing.notes,
        });
        onToast('success', 'Appointment updated.');
      } else {
        await api.createAppointment({
          customer_name: editing.customer_name || '',
          customer_email: editing.customer_email || undefined,
          customer_phone: editing.customer_phone || undefined,
          company: editing.company || undefined,
          service_topic: editing.service_topic || 'AI Sales Discovery Call',
          scheduled_date: editing.scheduled_date || '',
          scheduled_time: editing.scheduled_time || '',
          duration_minutes: editing.duration_minutes || 30,
          confirmed_by_customer: Boolean(editing.confirmed_by_customer),
          notes: editing.notes || undefined,
        });
        onToast('success', 'Appointment confirmed & saved in SQLite!');
      }
      dialogRef.current?.close();
      setEditing(null);
      await loadAppointments();
    } catch (err: any) {
      onToast('error', err?.message || 'Booking validation failed.');
    }
  };

  const handleCancel = async (appt: Appointment) => {
    try {
      await api.cancelAppointment(appt.id);
      onToast('info', `Cancelled appointment ${appt.appointment_code}.`);
      await loadAppointments();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to cancel appointment.');
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const filtered = appointments.filter((a) => {
    const isPastOrClosed = a.scheduled_date < todayStr || a.status === 'Cancelled' || a.status === 'Completed';
    return tab === 'upcoming' ? !isPastOrClosed : isPastOrClosed;
  });

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="Appointments"
        subtitle="Asia/Kolkata (IST) discovery call scheduling with overlap & past-date protection"
        onRefresh={loadAppointments}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A]"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>Book Appointment</span>
          </button>
        }
      />

      <main id="main-content" className="flex-1 space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7ECE7] bg-white p-4 shadow-2xs">
          <div className="inline-flex rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upcoming'}
              onClick={() => setTab('upcoming')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                tab === 'upcoming' ? 'bg-[#16865A] text-white' : 'text-[#78847D]'
              }`}
            >
              Upcoming Confirmed
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'past'}
              onClick={() => setTab('past')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                tab === 'past' ? 'bg-[#16865A] text-white' : 'text-[#78847D]'
              }`}
            >
              Past / Completed / Cancelled
            </button>
          </div>

          <search className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#78847D]" aria-hidden="true" />
              <label htmlFor="appt-search" className="visually-hidden">Search appointments</label>
              <input
                id="appt-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, code, company..."
                className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] py-2 pr-3 pl-9 text-sm"
              />
            </div>
            <div>
              <label htmlFor="appt-date-filter" className="visually-hidden">Filter by date</label>
              <input
                id="appt-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              />
            </div>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-xs font-semibold text-[#16865A] hover:underline"
              >
                Clear date
              </button>
            )}
          </search>
        </div>

        {loading && appointments.length === 0 ? (
          <LoadingState message="Loading appointments..." />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E7ECE7] bg-white p-12 text-center">
            <p className="text-sm font-semibold text-[#202923]">No {tab} appointments</p>
            <p className="mt-1 text-xs text-[#78847D]">
              Book a discovery call manually or confirm a slot inside the AI Voice Agent.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                onEdit={openEditModal}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </main>

      <dialog
        ref={dialogRef}
        aria-labelledby="appt-dialog-title"
        className="vox-dialog"
        onClose={() => {
          if (dialogRef.current) dialogRef.current.returnValue = '';
        }}
      >
        {editing && (
          <form onSubmit={handleSave} className="flex max-h-[88vh] flex-col">
            <div className="flex items-center justify-between border-b border-[#E7ECE7] px-6 py-4">
              <h1 id="appt-dialog-title" className="text-lg font-semibold text-[#202923]">
                {editing.id ? `Edit ${editing.appointment_code}` : 'Book Sales Appointment (IST)'}
              </h1>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close appointment dialog"
                className="rounded-xl p-2 text-[#78847D] hover:bg-[#F3F6F1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-3.5 overflow-y-auto p-6 sm:grid-cols-2">
              <div>
                <label htmlFor="af-name" className="block text-xs font-medium text-[#78847D]">
                  Customer Name <span aria-hidden="true">*</span>
                </label>
                <input id="af-name" autoFocus required type="text" value={editing.customer_name || ''} onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="af-company" className="block text-xs font-medium text-[#78847D]">Company</label>
                <input id="af-company" type="text" value={editing.company || ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="af-email" className="block text-xs font-medium text-[#78847D]">Email</label>
                <input id="af-email" type="email" value={editing.customer_email || ''} onChange={(e) => setEditing({ ...editing, customer_email: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="af-phone" className="block text-xs font-medium text-[#78847D]">Phone</label>
                <input id="af-phone" type="tel" value={editing.customer_phone || ''} onChange={(e) => setEditing({ ...editing, customer_phone: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="af-date" className="block text-xs font-medium text-[#78847D]">
                  Date (IST) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="af-date"
                  required
                  type="date"
                  value={editing.scheduled_date || ''}
                  onChange={(e) => {
                    setEditing({ ...editing, scheduled_date: e.target.value });
                    loadSlots(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="af-time" className="block text-xs font-medium text-[#78847D]">
                  Time (HH:MM 24h IST) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="af-time"
                  required
                  type="time"
                  value={editing.scheduled_time || ''}
                  onChange={(e) => setEditing({ ...editing, scheduled_time: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                />
              </div>

              {slots.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-medium text-[#78847D]">Available Open Slots:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((s) => (
                      <button
                        key={`${s.date}-${s.time}`}
                        type="button"
                        onClick={() => setEditing({ ...editing, scheduled_date: s.date, scheduled_time: s.time })}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          editing.scheduled_time === s.time && editing.scheduled_date === s.date
                            ? 'border-[#16865A] bg-[#DDF2E7] text-[#16865A]'
                            : 'border-[#E7ECE7] bg-[#FAFAF7] text-[#202923]'
                        }`}
                      >
                        {s.time} IST
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="af-topic" className="block text-xs font-medium text-[#78847D]">Service Topic</label>
                <input id="af-topic" type="text" value={editing.service_topic || ''} onChange={(e) => setEditing({ ...editing, service_topic: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="af-notes" className="block text-xs font-medium text-[#78847D]">Notes</label>
                <textarea id="af-notes" rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>

              {!editing.id && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="af-confirm"
                    type="checkbox"
                    required
                    checked={Boolean(editing.confirmed_by_customer)}
                    onChange={(e) => setEditing({ ...editing, confirmed_by_customer: e.target.checked })}
                    className="h-4 w-4 accent-[#16865A]"
                  />
                  <label htmlFor="af-confirm" className="text-xs font-medium text-[#202923]">
                    Customer explicitly confirmed this appointment slot
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-[#E7ECE7] px-6 py-4">
              <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-xl border border-[#E7ECE7] px-4 py-2 text-sm font-medium">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A]">
                {editing.id ? 'Save Changes' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
};
