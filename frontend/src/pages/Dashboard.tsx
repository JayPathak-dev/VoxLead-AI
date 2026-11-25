import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  CalendarCheck,
  TrendingUp,
  Award,
  MessagesSquare,
  DatabaseZap,
  Mic,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  AnalyticsOverview,
  AppointmentsAnalytics,
  Lead,
  LeadsAnalytics,
  NavPage,
  SentimentAnalytics,
} from '../types';
import { Header } from '../components/Header';
import { StatCard } from '../components/StatCard';
import { LoadingState } from '../components/LoadingState';
import {
  AppointmentTrendsChart,
  LeadStatusChart,
  LeadsTimelineChart,
  SentimentPieChart,
} from '../components/Charts';
import { SentimentBadge, StatusBadge } from '../components/LeadCard';

interface DashboardProps {
  onNavigate: (page: NavPage) => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [leadsData, setLeadsData] = useState<LeadsAnalytics | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentAnalytics | null>(null);
  const [apptData, setApptData] = useState<AppointmentsAnalytics | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ld, st, ap, leadsList] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getAnalyticsLeads(),
        api.getAnalyticsSentiment(),
        api.getAnalyticsAppointments(),
        api.listLeads({ sort_by: 'created_at', sort_order: 'desc' }),
      ]);
      setOverview(ov);
      setLeadsData(ld);
      setSentimentData(st);
      setApptData(ap);
      setRecentLeads(leadsList.slice(0, 6));
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await api.seedDemoData();
      onToast(res.seeded ? 'success' : 'info', res.message);
      await loadAll();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to seed demo data.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="Executive Overview"
        subtitle="Real-time CRM pipeline, autonomous voice agent metrics, and local AI activity"
        onRefresh={loadAll}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={() => onNavigate('voice-agent')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A]"
          >
            <Mic className="h-4 w-4" />
            <span>Launch Voice Agent</span>
          </button>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 p-6">
        {loading && !overview ? (
          <LoadingState message="Loading live metrics from SQLite..." />
        ) : overview && overview.total_leads === 0 && overview.total_conversations === 0 ? (
          <div className="rounded-2xl border border-[#E7ECE7] bg-white p-8 text-center shadow-2xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DDF2E7] text-[#16865A]">
              <DatabaseZap className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#202923]">Your VoxLead CRM is currently empty</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[#78847D]">
              All dashboard statistics come strictly from real SQLite records. Start a live conversation in the AI Voice
              Agent to generate your first lead, or explicitly load fictional sample business records for demonstration.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('voice-agent')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#16865A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#126E4A]"
              >
                <Mic className="h-4 w-4" />
                <span>Start Live AI Sales Call</span>
              </button>
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={seeding}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E7ECE7] bg-white px-5 py-2.5 text-sm font-semibold text-[#202923] hover:bg-[#F3F6F1] disabled:opacity-50"
              >
                <DatabaseZap className="h-4 w-4 text-[#16865A]" />
                <span>{seeding ? 'Seeding Sample Data...' : 'Load Sample Demo Data'}</span>
              </button>
            </div>
          </div>
        ) : null}

        {overview && (
          <>
            {/* KPI Grid */}
            <section aria-label="Key Metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Total Leads"
                value={overview.total_leads}
                hint="Captured across voice & chat"
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                label="Qualified Leads"
                value={overview.qualified_leads}
                hint="Met rule-based qualification criteria"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <StatCard
                label="Appointments Booked"
                value={overview.appointments_booked}
                hint="Confirmed & completed in IST"
                icon={<CalendarCheck className="h-5 w-5" />}
              />
              <StatCard
                label="Conversion Rate"
                value={`${overview.conversion_rate}%`}
                hint="Qualified / Total leads"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                label="Average Lead Score"
                value={`${overview.average_lead_score}/100`}
                hint="Transparent 6-factor scoring"
                icon={<Award className="h-5 w-5" />}
                accent="amber"
              />
              <StatCard
                label="Total Conversations"
                value={overview.total_conversations}
                hint={`${overview.knowledge_documents} KB documents indexed`}
                icon={<MessagesSquare className="h-5 w-5" />}
                accent="neutral"
              />
            </section>

            {/* Charts */}
            <section aria-label="Performance Charts" className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Leads Over Time</h2>
                <p className="mb-3 text-xs text-[#78847D]">Daily total vs qualified lead capture</p>
                <LeadsTimelineChart data={leadsData?.leads_over_time || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Lead Qualification Breakdown</h2>
                <p className="mb-3 text-xs text-[#78847D]">Distribution by CRM pipeline stage</p>
                <LeadStatusChart data={leadsData?.by_status || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Sentiment Distribution</h2>
                <p className="mb-3 text-xs text-[#78847D]">Customer conversational tone</p>
                <SentimentPieChart data={sentimentData?.distribution || []} />
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Appointment Trends</h2>
                <p className="mb-3 text-xs text-[#78847D]">Confirmed, completed, and cancelled calls</p>
                <AppointmentTrendsChart data={apptData?.trends || []} />
              </div>
            </section>

            {/* Recent Leads + Activity */}
            <section aria-label="Recent CRM Records" className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-[#202923]">Recent Leads</h2>
                    <p className="text-xs text-[#78847D]">Latest prospects captured by VoxLead AI</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('leads')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#16865A] hover:underline"
                  >
                    <span>View All Leads</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {recentLeads.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#78847D]">No leads recorded yet.</p>
                ) : (
                  <div tabIndex={0} role="region" aria-label="Recent leads table" className="vox-table-wrapper">
                    <table className="vox-table vox-table--responsive text-sm">
                      <caption className="visually-hidden">Recent leads captured in CRM</caption>
                      <thead>
                        <tr className="text-xs font-semibold text-[#78847D]">
                          <th scope="col">Customer</th>
                          <th scope="col">Industry</th>
                          <th scope="col">Budget</th>
                          <th scope="col">Score</th>
                          <th scope="col">Sentiment</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentLeads.map((lead) => (
                          <tr key={lead.id}>
                            <th scope="row" className="font-medium text-[#202923]">
                              <div>{lead.name || 'Unnamed Prospect'}</div>
                              <div className="text-xs font-normal text-[#78847D]">{lead.company || '—'}</div>
                            </th>
                            <td data-label="Industry" className="text-xs text-[#4B5850]">
                              {lead.business_type || '—'}
                            </td>
                            <td data-label="Budget" className="text-xs font-medium text-[#202923]">
                              {lead.budget || '—'}
                            </td>
                            <td data-label="Score" className="text-xs font-semibold text-[#16865A]">
                              {lead.lead_score}/100
                            </td>
                            <td data-label="Sentiment">
                              <SentimentBadge sentiment={lead.sentiment} />
                            </td>
                            <td data-label="Status">
                              <StatusBadge status={lead.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-semibold text-[#202923]">Recent Activity</h2>
                <p className="mb-4 text-xs text-[#78847D]">Live database events</p>
                {overview.recent_activity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#78847D]">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {overview.recent_activity.map((act, idx) => (
                      <li key={idx} className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#202923]">{act.title}</span>
                          <span className="rounded-md bg-[#DDF2E7] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#16865A]">
                            {act.type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#78847D]">{act.subtitle}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
