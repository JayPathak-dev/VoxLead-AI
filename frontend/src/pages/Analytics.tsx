import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AnalyticsOverview, AppointmentsAnalytics, LeadsAnalytics, SentimentAnalytics } from '../types';
import { Header } from '../components/Header';
import { LoadingState } from '../components/LoadingState';
import {
  AppointmentTrendsChart,
  LeadStatusChart,
  LeadsTimelineChart,
  PotentialPieChart,
  SentimentPieChart,
} from '../components/Charts';

export const Analytics: React.FC<{
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}> = ({ onToast }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [leads, setLeads] = useState<LeadsAnalytics | null>(null);
  const [sentiment, setSentiment] = useState<SentimentAnalytics | null>(null);
  const [appointments, setAppointments] = useState<AppointmentsAnalytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ld, st, ap] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getAnalyticsLeads(),
        api.getAnalyticsSentiment(),
        api.getAnalyticsAppointments(),
      ]);
      setOverview(ov);
      setLeads(ld);
      setSentiment(st);
      setAppointments(ap);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="Sales & AI Analytics"
        subtitle="Database-calculated conversion metrics, sentiment trends, popular services, and objection insights"
        onRefresh={loadAnalytics}
        refreshing={loading}
      />

      <main id="main-content" className="flex-1 space-y-6 p-6">
        {loading && !overview ? (
          <LoadingState message="Calculating analytics from SQLite..." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-4">
                <p className="text-xs font-medium text-[#78847D]">Qualification Rate</p>
                <p className="mt-1 text-2xl font-bold text-[#16865A]">{overview?.conversion_rate ?? 0}%</p>
              </div>
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-4">
                <p className="text-xs font-medium text-[#78847D]">Average Lead Score</p>
                <p className="mt-1 text-2xl font-bold text-[#202923]">{overview?.average_lead_score ?? 0}/100</p>
              </div>
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-4">
                <p className="text-xs font-medium text-[#78847D]">Conversation Volume</p>
                <p className="mt-1 text-2xl font-bold text-[#202923]">{overview?.total_conversations ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-4">
                <p className="text-xs font-medium text-[#78847D]">Booked Discovery Calls</p>
                <p className="mt-1 text-2xl font-bold text-[#16865A]">{overview?.appointments_booked ?? 0}</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Lead Generation Over Time</h2>
                <LeadsTimelineChart data={leads?.leads_over_time || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Lead Potential Tiers</h2>
                <PotentialPieChart data={leads?.by_potential || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Pipeline Status Counts</h2>
                <LeadStatusChart data={leads?.by_status || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Customer Sentiment Mix</h2>
                <SentimentPieChart data={sentiment?.distribution || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs lg:col-span-2">
                <h2 className="text-sm font-semibold text-[#202923]">Appointment Conversion &amp; Status Trends</h2>
                <AppointmentTrendsChart data={appointments?.trends || []} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Popular Services Discussed</h2>
                {!overview?.popular_services.length ? (
                  <p className="py-6 text-xs text-[#78847D]">No service interest records yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {overview.popular_services.map((s) => (
                      <li key={s.name} className="flex items-center justify-between rounded-xl bg-[#FAFAF7] px-3.5 py-2.5 text-sm">
                        <span className="font-medium text-[#202923]">{s.name}</span>
                        <span className="rounded-lg bg-[#DDF2E7] px-2.5 py-0.5 text-xs font-semibold text-[#16865A]">
                          {s.count} leads
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Common Customer Objections</h2>
                {!overview?.common_objections.length ? (
                  <p className="py-6 text-xs text-[#78847D]">No customer objections recorded yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {overview.common_objections.map((o) => (
                      <li key={o.name} className="flex items-center justify-between rounded-xl bg-[#FAFAF7] px-3.5 py-2.5 text-sm">
                        <span className="font-medium text-[#202923]">{o.name}</span>
                        <span className="rounded-lg bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-semibold text-[#D97706]">
                          {o.count} mentions
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
