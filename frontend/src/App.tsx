import { useCallback, useEffect, useState } from 'react';
import { api } from './services/api';
import type {
  HealthStatus,
  NavPage,
  OllamaConnectionState,
  ToastItem,
  WorkspaceSettings,
} from './types';
import { Sidebar } from './components/Sidebar';
import { ToastRegion } from './components/LoadingState';
import { Dashboard } from './pages/Dashboard';
import { VoiceAgent } from './pages/VoiceAgent';
import { Leads } from './pages/Leads';
import { Appointments } from './pages/Appointments';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

const DEFAULT_SETTINGS: WorkspaceSettings = {
  default_language: 'en',
  voice_rate: 1.0,
  voice_name: 'auto',
  tts_enabled: true,
  business_name: 'VoxLead Solutions',
  business_hours: '09:30 - 19:00 IST (Mon-Sat)',
  appointment_duration: 30,
  qualification_threshold: 70,
};

const PAGE_TITLES: Record<NavPage, string> = {
  overview: 'Overview | VoxLead AI',
  'voice-agent': 'AI Voice Agent | VoxLead AI',
  leads: 'CRM Leads | VoxLead AI',
  appointments: 'Appointments | VoxLead AI',
  knowledge: 'Knowledge Base | VoxLead AI',
  analytics: 'Analytics | VoxLead AI',
  settings: 'Settings | VoxLead AI',
};

export function App() {
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiState, setAiState] = useState<OllamaConnectionState>('connecting');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
      if (h.ollama_status === 'connected' && h.model_available) {
        setAiState('connected');
      } else if (h.ollama_status === 'model_missing') {
        setAiState('model_missing');
      } else {
        setAiState('disconnected');
      }
    } catch {
      setAiState('disconnected');
    }
  }, []);

  useEffect(() => {
    document.title = PAGE_TITLES[activePage];
  }, [activePage]);

  useEffect(() => {
    refreshHealth();
    api.getSettings().then(setSettings).catch(() => {});
    const timer = window.setInterval(refreshHealth, 25000);
    return () => window.clearInterval(timer);
  }, [refreshHealth]);

  const handleSaveSettings = async (updated: WorkspaceSettings) => {
    const saved = await api.updateSettings(updated);
    setSettings(saved);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF7] text-[#202923]">
      <a href="#main-content" className="skip-link visually-hidden rounded-lg bg-[#16865A] px-3 py-2 text-xs font-semibold text-white">
        Skip to main content
      </a>

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        aiState={aiState}
        modelName={health?.model_name || 'qwen2.5:3b'}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((v) => !v)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {activePage === 'overview' && <Dashboard onNavigate={setActivePage} onToast={addToast} />}
        {activePage === 'voice-agent' && (
          <VoiceAgent aiState={aiState} settings={settings} onToast={addToast} />
        )}
        {activePage === 'leads' && <Leads onToast={addToast} />}
        {activePage === 'appointments' && <Appointments onToast={addToast} />}
        {activePage === 'knowledge' && <KnowledgeBase onToast={addToast} />}
        {activePage === 'analytics' && <Analytics onToast={addToast} />}
        {activePage === 'settings' && (
          <Settings
            health={health}
            settings={settings}
            onRefreshHealth={refreshHealth}
            onSaveSettings={handleSaveSettings}
            onToast={addToast}
          />
        )}
      </div>

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
