import React from 'react';
import {
  LayoutDashboard,
  Mic,
  Users,
  CalendarClock,
  BookOpen,
  BarChart3,
  Settings,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import type { NavPage, OllamaConnectionState } from '../types';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  aiState: OllamaConnectionState;
  modelName: string;
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

const NAV_ITEMS: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'voice-agent', label: 'AI Voice Agent', icon: Mic },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  aiState,
  modelName,
  mobileOpen,
  onToggleMobile,
}) => {
  const statusConfig: Record<
    OllamaConnectionState,
    { label: string; dotClass: string; badgeClass: string; hint: string }
  > = {
    connected: {
      label: 'AI Connected',
      dotClass: 'bg-[#16A34A]',
      badgeClass: 'bg-[#DDF2E7] text-[#126E4A] border-[#BEE6D2]',
      hint: `${modelName} ready via Docker`,
    },
    connecting: {
      label: 'Connecting',
      dotClass: 'bg-[#D97706] animate-pulse',
      badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
      hint: 'Checking local Ollama...',
    },
    model_missing: {
      label: 'Model Not Found',
      dotClass: 'bg-[#D97706]',
      badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
      hint: `Pull ${modelName} in Docker`,
    },
    disconnected: {
      label: 'AI Disconnected',
      dotClass: 'bg-[#DC2626]',
      badgeClass: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
      hint: 'Start voxlead-ollama container',
    },
  };

  const status = statusConfig[aiState];

  return (
    <>
      <button
        type="button"
        onClick={onToggleMobile}
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
        className="lg:hidden fixed top-3.5 left-3.5 z-50 inline-flex items-center justify-center rounded-xl border border-[#E7ECE7] bg-white p-2.5 text-[#202923] shadow-sm"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#202923]/30 lg:hidden"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[#E7ECE7] bg-[#F3F6F1] transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-[#E7ECE7] px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16865A] text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-[#202923]">VoxLead AI</div>
            <div className="text-xs font-medium text-[#78847D]">Sales Voice & CRM</div>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      if (mobileOpen) onToggleMobile();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#DDF2E7] text-[#16865A] shadow-2xs'
                        : 'text-[#4B5850] hover:bg-[#E9EFE7] hover:text-[#202923]'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#16865A]' : 'text-[#78847D]'}`} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Local AI Status Footer */}
        <div className="border-t border-[#E7ECE7] p-4">
          <div className={`rounded-xl border px-3.5 py-3 ${status.badgeClass}`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${status.dotClass}`} aria-hidden="true" />
              <span>{status.label}</span>
            </div>
            <p className="mt-1 text-[11px] opacity-85">{status.hint}</p>
          </div>
        </div>
      </aside>
    </>
  );
};
