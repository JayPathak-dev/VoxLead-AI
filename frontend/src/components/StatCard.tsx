import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: 'emerald' | 'amber' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  accent = 'emerald',
}) => {
  const iconBg =
    accent === 'emerald'
      ? 'bg-[#DDF2E7] text-[#16865A]'
      : accent === 'amber'
      ? 'bg-[#FEF3C7] text-[#D97706]'
      : 'bg-[#F3F6F1] text-[#202923]';

  return (
    <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#78847D]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#202923]">{value}</p>
          {hint && <p className="mt-1 text-xs text-[#78847D]">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
