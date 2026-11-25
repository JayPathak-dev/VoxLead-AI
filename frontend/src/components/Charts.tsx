import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#16A34A',
  Neutral: '#78847D',
  Negative: '#DC2626',
};

const POTENTIAL_COLORS: Record<string, string> = {
  'High potential': '#16865A',
  'Medium potential': '#D97706',
  'Low potential': '#94A3B8',
};

export const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-[#E7ECE7] bg-[#FAFAF7] px-4 text-center text-sm text-[#78847D]">
    {message}
  </div>
);

export const LeadsTimelineChart: React.FC<{
  data: { date: string; total: number; qualified: number }[];
}> = ({ data }) => {
  if (!data.length) return <EmptyChartState message="No lead timeline records yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE7" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78847D' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#78847D' }} />
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E7ECE7' }} />
          <Legend />
          <Area type="monotone" dataKey="total" name="Total Leads" stroke="#16865A" fill="#DDF2E7" strokeWidth={2} />
          <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#16A34A" fill="#BBF7D0" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LeadStatusChart: React.FC<{
  data: { status: string; count: number }[];
}> = ({ data }) => {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return <EmptyChartState message="No lead status distribution data yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE7" />
          <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#78847D' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#78847D' }} />
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E7ECE7' }} />
          <Bar dataKey="count" name="Leads" fill="#16865A" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const SentimentPieChart: React.FC<{
  data: { sentiment: string; count: number }[];
}> = ({ data }) => {
  const nonZero = data.filter((d) => d.count > 0);
  if (!nonZero.length) return <EmptyChartState message="No sentiment records captured yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={nonZero} dataKey="count" nameKey="sentiment" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={3}>
            {nonZero.map((entry) => (
              <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment] || '#78847D'} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E7ECE7' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PotentialPieChart: React.FC<{
  data: { category: string; count: number }[];
}> = ({ data }) => {
  const nonZero = data.filter((d) => d.count > 0);
  if (!nonZero.length) return <EmptyChartState message="No lead scoring categories yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={nonZero} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={3}>
            {nonZero.map((entry) => (
              <Cell key={entry.category} fill={POTENTIAL_COLORS[entry.category] || '#16865A'} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E7ECE7' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AppointmentTrendsChart: React.FC<{
  data: { date: string; confirmed: number; cancelled: number; completed: number }[];
}> = ({ data }) => {
  if (!data.length) return <EmptyChartState message="No appointment booking trends yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE7" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78847D' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#78847D' }} />
          <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E7ECE7' }} />
          <Legend />
          <Bar dataKey="confirmed" name="Confirmed" fill="#16865A" radius={[6, 6, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#16A34A" radius={[6, 6, 0, 0]} />
          <Bar dataKey="cancelled" name="Cancelled" fill="#DC2626" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
