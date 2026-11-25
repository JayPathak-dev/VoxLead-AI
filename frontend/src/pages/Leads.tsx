import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Trash2, Eye, Edit3, X, MessageSquare, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import type { Lead, LeadStatus } from '../types';
import { Header } from '../components/Header';
import { LoadingState } from '../components/LoadingState';
import { SentimentBadge, StatusBadge } from '../components/LeadCard';

export const Leads: React.FC<{
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}> = ({ onToast }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sentimentFilter, setSentimentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [transcript, setTranscript] = useState<Array<{ id: number; role: string; content: string; created_at: string }>>([]);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);

  const detailDialogRef = useRef<HTMLDialogElement | null>(null);
  const formDialogRef = useRef<HTMLDialogElement | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listLeads({
        search: search || undefined,
        status: statusFilter,
        sentiment: sentimentFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setLeads(data);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to load CRM leads.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sentimentFilter, sortBy, sortOrder, onToast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const openDetailModal = async (lead: Lead) => {
    setSelectedLead(lead);
    setTranscript([]);
    detailDialogRef.current?.showModal();
    if (lead.conversation_ids.length > 0) {
      try {
        const msgs = await api.getConversationMessages(lead.conversation_ids[0]);
        setTranscript(msgs);
      } catch {
        // Ignore if conversation messages unavailable
      }
    }
  };

  const openCreateModal = () => {
    setEditingLead({
      name: '',
      email: '',
      phone: '',
      company: '',
      business_type: '',
      requirement: '',
      budget: '',
      business_size: '',
      buying_intent: 'Medium',
      sentiment: 'Neutral',
      lead_score: 50,
      status: 'New',
      source: 'Manual CRM',
    });
    formDialogRef.current?.showModal();
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead({ ...lead });
    formDialogRef.current?.showModal();
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    try {
      if (editingLead.id) {
        await api.updateLead(editingLead.id, editingLead);
        onToast('success', 'Lead updated successfully.');
      } else {
        await api.createLead(editingLead);
        onToast('success', 'New lead created.');
      }
      formDialogRef.current?.close();
      setEditingLead(null);
      await fetchLeads();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save lead.');
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    try {
      await api.deleteLead(lead.id);
      onToast('success', `Deleted lead ${lead.name || `#${lead.id}`}.`);
      detailDialogRef.current?.close();
      await fetchLeads();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to delete lead.');
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="CRM Leads"
        subtitle="Manage qualified prospects, lead scores, transcripts, and AI-generated call summaries"
        onRefresh={fetchLeads}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lead</span>
          </button>
        }
      />

      <main id="main-content" className="flex-1 space-y-5 p-6">
        {/* Search & Filters */}
        <search className="rounded-2xl border border-[#E7ECE7] bg-white p-4 shadow-2xs">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <label htmlFor="lead-search" className="block text-xs font-medium text-[#78847D]">
                Search Leads
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#78847D]" aria-hidden="true" />
                <input
                  id="lead-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, company, email, requirement..."
                  className="w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] py-2 pr-3 pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="lead-status-filter" className="block text-xs font-medium text-[#78847D]">
                Status
              </label>
              <select
                id="lead-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              >
                {['All', 'New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="lead-sentiment-filter" className="block text-xs font-medium text-[#78847D]">
                Sentiment
              </label>
              <select
                id="lead-sentiment-filter"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              >
                {['All', 'Positive', 'Neutral', 'Negative'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="lead-sort" className="block text-xs font-medium text-[#78847D]">
                Sort By
              </label>
              <div className="mt-1 flex gap-1.5">
                <select
                  id="lead-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-2.5 py-2 text-sm"
                >
                  <option value="created_at">Created Date</option>
                  <option value="lead_score">Lead Score</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  aria-label="Toggle sort direction"
                  className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-2.5 py-2 text-xs font-semibold text-[#202923]"
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>
        </search>

        {/* Leads Table */}
        {loading && leads.length === 0 ? (
          <LoadingState message="Loading CRM leads..." />
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-[#E7ECE7] bg-white p-12 text-center">
            <p className="text-sm font-semibold text-[#202923]">No leads match your filters</p>
            <p className="mt-1 text-xs text-[#78847D]">
              Leads are automatically created during AI Voice Agent sessions or manually via Add Lead.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E7ECE7] bg-white shadow-2xs">
            <div tabIndex={0} role="region" aria-label="CRM leads directory" className="vox-table-wrapper">
              <table className="vox-table vox-table--responsive text-sm">
                <caption className="visually-hidden">CRM Leads Directory</caption>
                <thead>
                  <tr className="text-xs font-semibold text-[#78847D]">
                    <th scope="col">Lead / Company</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Requirement &amp; Budget</th>
                    <th scope="col">Intent / Sentiment</th>
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#FAFAF7]">
                      <th scope="row" className="font-semibold text-[#202923]">
                        <div>{lead.name || 'Unnamed Prospect'}</div>
                        <div className="text-xs font-normal text-[#78847D]">
                          {lead.company || '—'} • {lead.business_type || 'General'}
                        </div>
                      </th>
                      <td data-label="Contact" className="text-xs text-[#4B5850]">
                        <div>{lead.email || '—'}</div>
                        <div>{lead.phone || '—'}</div>
                      </td>
                      <td data-label="Requirement" className="max-w-xs text-xs text-[#4B5850]">
                        <p className="line-clamp-2">{lead.requirement || '—'}</p>
                        <p className="mt-0.5 font-semibold text-[#16865A]">
                          Budget: {lead.budget || 'Not specified'}
                        </p>
                      </td>
                      <td data-label="Sentiment" className="space-y-1">
                        <div className="text-xs font-medium text-[#202923]">{lead.buying_intent} Intent</div>
                        <SentimentBadge sentiment={lead.sentiment} />
                      </td>
                      <td data-label="Score">
                        <div className="text-sm font-bold text-[#16865A]">{lead.lead_score}/100</div>
                        <div className="text-[11px] text-[#78847D]">{lead.score_category}</div>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td data-label="Actions" className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetailModal(lead)}
                            aria-label={`View details for ${lead.name || `Lead ${lead.id}`}`}
                            className="rounded-lg border border-[#E7ECE7] p-1.5 text-[#16865A] hover:bg-[#DDF2E7]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(lead)}
                            aria-label={`Edit ${lead.name || `Lead ${lead.id}`}`}
                            className="rounded-lg border border-[#E7ECE7] p-1.5 text-[#202923] hover:bg-[#F3F6F1]"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            aria-label={`Delete ${lead.name || `Lead ${lead.id}`}`}
                            className="rounded-lg border border-[#FECACA] p-1.5 text-[#DC2626] hover:bg-[#FEE2E2]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Native <dialog> for Lead Details, Transcript & Call Summary */}
      <dialog
        ref={detailDialogRef}
        aria-labelledby="lead-detail-title"
        className="vox-dialog"
        onClose={() => {
          if (detailDialogRef.current) detailDialogRef.current.returnValue = '';
        }}
      >
        {selectedLead && (
          <div className="flex max-h-[88vh] flex-col">
            <div className="flex items-center justify-between border-b border-[#E7ECE7] px-6 py-4">
              <div>
                <h1 id="lead-detail-title" className="text-lg font-semibold text-[#202923]">
                  {selectedLead.name || 'Unnamed Prospect'}
                </h1>
                <p className="text-xs text-[#78847D]">
                  {selectedLead.company || 'No company'} • {selectedLead.source} • Created{' '}
                  {new Date(selectedLead.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => detailDialogRef.current?.close()}
                aria-label="Close lead details"
                className="rounded-xl p-2 text-[#78847D] hover:bg-[#F3F6F1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm">
              {/* Structured Summary */}
              {selectedLead.summary && (
                <section className="rounded-2xl border border-[#BEE6D2] bg-[#FAFAF7] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#16865A]">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>AI-Generated Call Summary</span>
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p><strong>Business Type:</strong> {selectedLead.summary.business_type}</p>
                    <p><strong>Budget:</strong> {selectedLead.summary.budget}</p>
                    <p><strong>Buying Intent:</strong> {selectedLead.summary.buying_intent}</p>
                    <p><strong>Sentiment:</strong> {selectedLead.summary.sentiment}</p>
                    <p><strong>Lead Score:</strong> {selectedLead.summary.lead_score}/100 ({selectedLead.summary.qualification_status})</p>
                    <p><strong>Appointment:</strong> {selectedLead.summary.appointment_status}</p>
                  </div>
                  <p className="mt-2 text-xs"><strong>Main Requirement:</strong> {selectedLead.summary.main_requirement}</p>
                  <p className="mt-1 text-xs text-[#16865A]">
                    <strong>Recommended Next Action:</strong> {selectedLead.summary.recommended_next_action}
                  </p>
                </section>
              )}

              {/* Score Breakdown */}
              {selectedLead.score_breakdown && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#78847D]">
                    Lead Score Breakdown ({selectedLead.lead_score}/100)
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedLead.score_breakdown.criteria.map((c) => (
                      <div key={c.criterion} className="rounded-xl border border-[#E7ECE7] p-3 text-xs">
                        <div className="flex justify-between font-semibold text-[#202923]">
                          <span>{c.criterion}</span>
                          <span className="text-[#16865A]">
                            {c.points}/{c.max_points}
                          </span>
                        </div>
                        <p className="mt-1 text-[#78847D]">{c.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Conversation History */}
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#78847D]">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Conversation History</span>
                </h2>
                {transcript.length === 0 ? (
                  <p className="rounded-xl border border-[#E7ECE7] p-4 text-xs text-[#78847D]">
                    No linked conversation transcript recorded.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3.5">
                    {transcript.map((m) => (
                      <div key={m.id} className="text-xs">
                        <span className={`font-semibold ${m.role === 'user' ? 'text-[#16865A]' : 'text-[#202923]'}`}>
                          {m.role === 'user' ? 'Customer' : 'VoxLead AI'}:{' '}
                        </span>
                        <span className="text-[#4B5850]">{m.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </dialog>

      {/* Native <dialog> for Create / Edit Lead */}
      <dialog
        ref={formDialogRef}
        aria-labelledby="lead-form-title"
        className="vox-dialog"
        onClose={() => {
          if (formDialogRef.current) formDialogRef.current.returnValue = '';
        }}
      >
        {editingLead && (
          <form onSubmit={handleSaveLead} className="flex max-h-[88vh] flex-col">
            <div className="flex items-center justify-between border-b border-[#E7ECE7] px-6 py-4">
              <h1 id="lead-form-title" className="text-lg font-semibold text-[#202923]">
                {editingLead.id ? 'Edit Lead' : 'Create New Lead'}
              </h1>
              <button
                type="button"
                onClick={() => formDialogRef.current?.close()}
                aria-label="Close form"
                className="rounded-xl p-2 text-[#78847D] hover:bg-[#F3F6F1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-3.5 overflow-y-auto p-6 sm:grid-cols-2">
              <div>
                <label htmlFor="lf-name" className="block text-xs font-medium text-[#78847D]">Customer Name</label>
                <input id="lf-name" autoFocus type="text" value={editingLead.name || ''} onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-company" className="block text-xs font-medium text-[#78847D]">Company</label>
                <input id="lf-company" type="text" value={editingLead.company || ''} onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-email" className="block text-xs font-medium text-[#78847D]">Email</label>
                <input id="lf-email" type="email" value={editingLead.email || ''} onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-phone" className="block text-xs font-medium text-[#78847D]">Phone</label>
                <input id="lf-phone" type="tel" value={editingLead.phone || ''} onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-btype" className="block text-xs font-medium text-[#78847D]">Business Type</label>
                <input id="lf-btype" type="text" value={editingLead.business_type || ''} onChange={(e) => setEditingLead({ ...editingLead, business_type: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-budget" className="block text-xs font-medium text-[#78847D]">Budget</label>
                <input id="lf-budget" type="text" value={editingLead.budget || ''} onChange={(e) => setEditingLead({ ...editingLead, budget: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="lf-status" className="block text-xs font-medium text-[#78847D]">Status</label>
                <select id="lf-status" value={editingLead.status || 'New'} onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as LeadStatus })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm">
                  {['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lf-score" className="block text-xs font-medium text-[#78847D]">Lead Score (0-100)</label>
                <input id="lf-score" type="number" min={0} max={100} value={editingLead.lead_score ?? 0} onChange={(e) => setEditingLead({ ...editingLead, lead_score: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="lf-req" className="block text-xs font-medium text-[#78847D]">Requirement</label>
                <textarea id="lf-req" rows={3} value={editingLead.requirement || ''} onChange={(e) => setEditingLead({ ...editingLead, requirement: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-[#E7ECE7] px-6 py-4">
              <button type="button" onClick={() => formDialogRef.current?.close()} className="rounded-xl border border-[#E7ECE7] px-4 py-2 text-sm font-medium">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A]">
                Save Lead
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
};
