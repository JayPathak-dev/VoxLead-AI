import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, PlugZap, Save } from 'lucide-react';
import { api } from '../services/api';
import type { HealthStatus, WorkspaceSettings } from '../types';
import { Header } from '../components/Header';

interface SettingsProps {
  health: HealthStatus | null;
  settings: WorkspaceSettings;
  onRefreshHealth: () => Promise<void>;
  onSaveSettings: (updated: WorkspaceSettings) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  health,
  settings,
  onRefreshHealth,
  onSaveSettings,
  onToast,
}) => {
  const [form, setForm] = useState<WorkspaceSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await onRefreshHealth();
      const latest = await api.getHealth();
      if (latest.ollama_status === 'connected' && latest.model_available) {
        onToast('success', `Connected to Ollama (${latest.model_name}) at ${latest.ollama_base_url}`);
      } else if (latest.ollama_status === 'model_missing') {
        onToast('error', `Ollama reachable, but model '${latest.model_name}' is not installed yet.`);
      } else {
        onToast('error', latest.error_detail || 'Ollama container is unreachable.');
      }
    } catch (err: any) {
      onToast('error', err?.message || 'Backend health check failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(form);
      onToast('success', 'Workspace settings saved to SQLite.');
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="System & Agent Settings"
        subtitle="Docker Ollama connection health, voice/language preferences, and lead scoring thresholds"
      />

      <main id="main-content" className="flex-1 space-y-6 p-6">
        {/* Local AI Infrastructure Status */}
        <section className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#202923]">Local Docker Ollama Connection</h2>
              <p className="text-xs text-[#78847D]">
                FastAPI communicates with the containerized Ollama runtime over local HTTP.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#BEE6D2] bg-[#DDF2E7] px-4 py-2 text-xs font-semibold text-[#126E4A] hover:bg-[#CCEAD9]"
            >
              <PlugZap className="h-4 w-4" />
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3">
              <span className="text-[#78847D]">Ollama Status</span>
              <p className="mt-1 flex items-center gap-1.5 font-semibold text-[#202923]">
                {health?.ollama_status === 'connected' ? (
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                )}
                <span>{health?.ollama_status || 'unknown'}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3">
              <span className="text-[#78847D]">Configured Model</span>
              <p className="mt-1 font-semibold text-[#202923]">{health?.model_name || 'qwen2.5:3b'}</p>
            </div>
            <div className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3">
              <span className="text-[#78847D]">Local API Endpoint</span>
              <p className="mt-1 font-mono font-semibold text-[#202923]">
                {health?.ollama_base_url || 'http://localhost:11434'}
              </p>
            </div>
            <div className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3">
              <span className="text-[#78847D]">Embeddings &amp; Vector Store</span>
              <p className="mt-1 font-semibold text-[#202923]">
                all-MiniLM-L6-v2 ({health?.knowledge_chunks ?? 0} chunks)
              </p>
            </div>
          </div>

          {health?.install_instructions && (
            <div className="mt-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
              <strong>Setup command:</strong> <code>{health.install_instructions}</code>
            </div>
          )}
        </section>

        {/* Preferences Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-semibold text-[#202923]">Agent, Voice &amp; CRM Configuration</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-lang" className="block text-xs font-medium text-[#78847D]">Default Language</label>
              <select
                id="st-lang"
                value={form.default_language}
                onChange={(e) => setForm({ ...form, default_language: e.target.value as 'en' | 'hi' })}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              >
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>

            <div>
              <label htmlFor="st-rate" className="block text-xs font-medium text-[#78847D]">
                SpeechSynthesis Voice Speed ({form.voice_rate}x)
              </label>
              <input
                id="st-rate"
                type="range"
                min={0.7}
                max={1.4}
                step={0.1}
                value={form.voice_rate}
                onChange={(e) => setForm({ ...form, voice_rate: Number(e.target.value) })}
                className="mt-2.5 w-full accent-[#16865A]"
              />
            </div>

            <div>
              <label htmlFor="st-bname" className="block text-xs font-medium text-[#78847D]">Business Name</label>
              <input
                id="st-bname"
                type="text"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="st-hours" className="block text-xs font-medium text-[#78847D]">Sales Business Hours</label>
              <input
                id="st-hours"
                type="text"
                value={form.business_hours}
                onChange={(e) => setForm({ ...form, business_hours: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="st-dur" className="block text-xs font-medium text-[#78847D]">
                Default Appointment Duration (minutes)
              </label>
              <input
                id="st-dur"
                type="number"
                min={15}
                max={90}
                step={15}
                value={form.appointment_duration}
                onChange={(e) => setForm({ ...form, appointment_duration: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="st-thresh" className="block text-xs font-medium text-[#78847D]">
                Lead Qualification Threshold (out of 100)
              </label>
              <input
                id="st-thresh"
                type="number"
                min={40}
                max={90}
                value={form.qualification_threshold}
                onChange={(e) => setForm({ ...form, qualification_threshold: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="st-tts"
                type="checkbox"
                checked={form.tts_enabled}
                onChange={(e) => setForm({ ...form, tts_enabled: e.target.checked })}
                className="h-4 w-4 accent-[#16865A]"
              />
              <label htmlFor="st-tts" className="text-xs font-medium text-[#202923]">
                Enable automatic Browser Text-to-Speech (TTS) playback for AI responses
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#126E4A] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
