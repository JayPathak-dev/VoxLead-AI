import React from 'react';
import { Building2, Mail, Phone, TrendingUp, Sparkles } from 'lucide-react';
import type { Lead } from '../types';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Qualified: 'bg-[#DDF2E7] text-[#126E4A] border-[#BEE6D2]',
    Converted: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
    Contacted: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
    New: 'bg-[#F3F6F1] text-[#202923] border-[#E7ECE7]',
    Unqualified: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] || styles.New}`}>
      {status}
    </span>
  );
};

export const SentimentBadge: React.FC<{ sentiment: string }> = ({ sentiment }) => {
  const styles: Record<string, string> = {
    Positive: 'bg-[#DCFCE7] text-[#15803D]',
    Neutral: 'bg-[#F3F6F1] text-[#4B5850]',
    Negative: 'bg-[#FEE2E2] text-[#DC2626]',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${styles[sentiment] || styles.Neutral}`}>
      {sentiment}
    </span>
  );
};

export const LeadCard: React.FC<{
  lead: Lead;
  onSelect: (lead: Lead) => void;
}> = ({ lead, onSelect }) => {
  return (
    <div className="rounded-2xl border border-[#E7ECE7] bg-white p-4 shadow-2xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#202923]">{lead.name || 'Unnamed Prospect'}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#78847D]">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lead.company || lead.business_type || 'Company pending'}</span>
          </p>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-xs text-[#4B5850]">
        {lead.requirement || 'No requirement details captured yet.'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#78847D]">
        {lead.email && (
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" aria-hidden="true" />
            {lead.email}
          </span>
        )}
        {lead.phone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" aria-hidden="true" />
            {lead.phone}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#E7ECE7] pt-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16865A]">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            {lead.lead_score}/100
          </span>
          <SentimentBadge sentiment={lead.sentiment} />
        </div>
        <button
          type="button"
          onClick={() => onSelect(lead)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#16865A] hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          View CRM &amp; Summary
        </button>
      </div>
    </div>
  );
};
