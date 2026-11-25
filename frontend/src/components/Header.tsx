import React from 'react';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  actions,
  onRefresh,
  refreshing,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7ECE7] bg-white px-6 py-4 pl-14 lg:pl-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#202923]">{title}</h1>
        <p className="mt-0.5 text-sm text-[#78847D]">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {actions}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7ECE7] bg-white px-3.5 py-2 text-sm font-medium text-[#202923] hover:bg-[#F3F6F1] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-[#78847D] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
};
