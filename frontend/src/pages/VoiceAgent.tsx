import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  CalendarCheck,
  Target,
  Wallet,
  Building2,
  User,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import type {
  CallSummary,
  ChatTurn,
  ConversationIntelligence,
  OllamaConnectionState,
  WorkspaceSettings,
} from '../types';
import { Header } from '../components/Header';
import { VoicePanel } from '../components/VoicePanel';
import { ChatMessage } from '../components/ChatMessage';
import { SentimentBadge, StatusBadge } from '../components/LeadCard';

interface VoiceAgentProps {
  aiState: OllamaConnectionState;
  settings: WorkspaceSettings;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const SAMPLE_PROMPTS = [
  "Hi, I'm Aarav from CartPulse. We run an e-commerce store with 500 daily customer queries and want to automate support.",
  'What are your monthly pricing plans in INR?',
  'Our monthly budget is ₹40,000 and we want to launch this month.',
  'Please show available appointment slots for tomorrow and book 15:00.',
];

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ aiState, settings, onToast }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>(settings.default_language || 'en');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(settings.tts_enabled ?? true);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Optional customer pre-fill fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [company, setCompany] = useState('');

  const [intelligence, setIntelligence] = useState<ConversationIntelligence | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const sendMessageRef = useRef<(msg: string, ch?: 'voice' | 'text') => void>(() => {});

  const speech = useSpeech(language, ttsEnabled, settings.voice_rate || 1.0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isSending]);

  const startConversation = () => {
    setSessionActive(true);
    setSummary(null);
    if (turns.length === 0) {
      const greeting =
        language === 'hi'
          ? 'नमस्ते! मैं VoxLead Solutions से VoxLead AI हूँ। मैं आपके व्यवसाय के लिए AI वॉयस या चैट ऑटोमेशन खोजने में आपकी मदद कर सकती हूँ। आज आप किस प्रकार की समस्या या प्रक्रिया ऑटोमेट करना चाहते हैं?'
          : "Hello! I'm VoxLead AI from VoxLead Solutions. I can help you explore AI chatbots, autonomous voice agents, or CRM automation for your business. What workflow are you looking to automate today?";
      setTurns([
        {
          id: `greet-${Date.now()}`,
          role: 'assistant',
          content: greeting,
          language,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (ttsEnabled) speech.speak(greeting);
    }
  };

  const sendMessage = async (rawMessage: string, channel: 'voice' | 'text' = 'text') => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isSending) return;

    if (!sessionActive) setSessionActive(true);
    setSummary(null);
    setInputText('');

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      language,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setTurns((prev) => [...prev, userTurn]);
    setIsSending(true);

    try {
      const res = await api.sendChat({
        session_id: sessionId,
        message: trimmed,
        language,
        channel,
        customer_name: customerName.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        company: company.trim() || undefined,
      });

      setSessionId(res.session_id);
      setIntelligence(res.intelligence);
      setLastLatencyMs(res.latency_ms);

      // Sync extracted details back into customer panel if discovered
      if (res.intelligence.customer_name && !customerName) setCustomerName(res.intelligence.customer_name);
      if (res.intelligence.customer_email && !customerEmail) setCustomerEmail(res.intelligence.customer_email);
      if (res.intelligence.customer_phone && !customerPhone) setCustomerPhone(res.intelligence.customer_phone);
      if (res.intelligence.company && !company) setCompany(res.intelligence.company);

      const aiTurn: ChatTurn = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        language: res.language,
        sentiment: res.intelligence.sentiment,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTurns((prev) => [...prev, aiTurn]);

      if (!res.ollama_used && res.error) {
        onToast('error', res.error);
      } else if (ttsEnabled) {
        speech.speak(res.reply);
      }

      if (res.intelligence.appointment_details?.appointment_code) {
        onToast(
          'success',
          `Appointment ${res.intelligence.appointment_details.appointment_code} confirmed & saved to CRM!`
        );
      }
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to reach VoxLead backend.');
    } finally {
      setIsSending(false);
    }
  };

  sendMessageRef.current = sendMessage;

  const handleEndAndSummarize = async () => {
    speech.stopListening();
    speech.stopSpeaking();
    setSessionActive(false);

    if (!sessionId) {
      onToast('info', 'Send at least one message before generating a call summary.');
      return;
    }
    setIsSending(true);
    try {
      const res = await api.summarizeConversation(sessionId, true);
      setSummary(res.summary);
      onToast('success', 'Structured AI call summary generated and saved to CRM.');
    } catch (err: any) {
      onToast('error', err?.message || 'Could not generate call summary.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    speech.stopListening();
    speech.stopSpeaking();
    setSessionId(null);
    setSessionActive(false);
    setTurns([]);
    setIntelligence(null);
    setSummary(null);
    setLastLatencyMs(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCompany('');
  };

  const handleToggleMic = () => {
    if (speech.isListening) {
      speech.stopListening();
    } else {
      if (!sessionActive) setSessionActive(true);
      speech.startListening((transcript) => {
        sendMessageRef.current(transcript, 'voice');
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="AI Sales Voice Agent"
        subtitle="Real-time voice & text sales qualification powered by Docker Ollama (Qwen 2.5 3B) + FAISS RAG"
        actions={
          sessionId ? (
            <span className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-1.5 text-xs font-medium text-[#78847D]">
              Session: {sessionId.slice(0, 8)}...
            </span>
          ) : null
        }
      />

      <main id="main-content" className="flex-1 p-6">
        {aiState !== 'connected' && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                {aiState === 'model_missing'
                  ? 'Qwen 2.5 3B model is not pulled yet in Docker Ollama.'
                  : 'Local Ollama Docker service is disconnected.'}
              </p>
              <p className="mt-0.5 text-xs">
                Run <code>docker compose up -d ollama</code> and{' '}
                <code>docker exec -it voxlead-ollama ollama pull qwen2.5:3b</code> to enable live local AI responses.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-12">
          {/* Left/Main Column: Voice Control + Customer Info + Transcript */}
          <div className="space-y-5 xl:col-span-8">
            <VoicePanel
              sessionActive={sessionActive}
              isListening={speech.isListening}
              isSpeaking={speech.isSpeaking}
              isLoading={isSending}
              sttSupported={speech.sttSupported}
              ttsSupported={speech.ttsSupported}
              ttsEnabled={ttsEnabled}
              language={language}
              interimTranscript={speech.interimTranscript}
              sttError={speech.sttError}
              onStartSession={startConversation}
              onEndSession={handleEndAndSummarize}
              onClearSession={handleClear}
              onToggleMic={handleToggleMic}
              onToggleTts={() => setTtsEnabled((v) => !v)}
              onStopSpeaking={speech.stopSpeaking}
              onLanguageChange={setLanguage}
            />

            {/* Optional Customer Context Bar */}
            <details className="rounded-2xl border border-[#E7ECE7] bg-white p-4 shadow-2xs">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#78847D]">
                Customer Details (Optional Pre-fill / Auto-captured)
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="va-name" className="block text-xs font-medium text-[#78847D]">
                    Name
                  </label>
                  <input
                    id="va-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Aarav Mehta"
                    className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="va-company" className="block text-xs font-medium text-[#78847D]">
                    Company
                  </label>
                  <input
                    id="va-company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. OrbitMart"
                    className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="va-email" className="block text-xs font-medium text-[#78847D]">
                    Email
                  </label>
                  <input
                    id="va-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="aarav@company.com"
                    className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="va-phone" className="block text-xs font-medium text-[#78847D]">
                    Phone
                  </label>
                  <input
                    id="va-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="mt-1 w-full rounded-xl border border-[#E7ECE7] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </details>

            {/* Conversation History + Text Fallback */}
            <div className="flex flex-col rounded-2xl border border-[#E7ECE7] bg-white shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E7ECE7] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#16865A]" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-[#202923]">Live Conversation Transcript</h2>
                </div>
                {lastLatencyMs !== null && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#78847D]">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    LLM: {(lastLatencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              <div className="h-[360px] space-y-4 overflow-y-auto bg-[#FAFAF7] p-5">
                {turns.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <p className="text-sm font-medium text-[#202923]">Ready for your sales conversation</p>
                    <p className="mt-1 max-w-md text-xs text-[#78847D]">
                      Click Start Conversation, use the microphone, or try one of the quick demo prompts below.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {SAMPLE_PROMPTS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => sendMessage(p, 'text')}
                          className="rounded-xl border border-[#E7ECE7] bg-white px-3 py-1.5 text-left text-xs text-[#202923] hover:border-[#16865A] hover:bg-[#DDF2E7]/40"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  turns.map((turn) => <ChatMessage key={turn.id} turn={turn} />)
                )}
                {isSending && (
                  <div className="flex items-center gap-2 text-xs font-medium text-[#16865A]">
                    <span className="h-2 w-2 animate-ping rounded-full bg-[#16865A]" />
                    <span>Retrieving RAG knowledge &amp; generating local Qwen response...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Offered Appointment Slots Quick Selector */}
              {intelligence && intelligence.available_slots_offered.length > 0 && !intelligence.appointment_details && (
                <div className="border-t border-[#E7ECE7] bg-[#F3F6F1] px-4 py-2.5">
                  <p className="mb-1.5 text-xs font-semibold text-[#16865A]">
                    Quick-Confirm Available IST Slots:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {intelligence.available_slots_offered.map((slotLabel) => (
                      <button
                        key={slotLabel}
                        type="button"
                        disabled={isSending}
                        onClick={() => sendMessage(`Yes, please confirm ${slotLabel}`, 'text')}
                        className="rounded-lg border border-[#BEE6D2] bg-white px-2.5 py-1 text-xs font-medium text-[#126E4A] hover:bg-[#DDF2E7]"
                      >
                        Confirm {slotLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Input Fallback */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(inputText, 'text');
                }}
                className="flex items-center gap-2.5 border-t border-[#E7ECE7] bg-white p-3.5"
              >
                <label htmlFor="chat-text-input" className="visually-hidden">
                  Type your message to VoxLead AI
                </label>
                <input
                  id="chat-text-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendMessage(inputText, 'text');
                    }
                  }}
                  placeholder={
                    language === 'hi'
                      ? 'यहाँ संदेश लिखें (टेक्स्ट फ़ॉलबैक हमेशा उपलब्ध है)...'
                      : 'Type a message (text fallback always works without a microphone)...'
                  }
                  className="flex-1 rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-4 py-2.5 text-sm text-[#202923]"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#126E4A] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Real-Time Conversation Intelligence Panel */}
          <aside aria-label="Conversation Intelligence" className="space-y-4 xl:col-span-4">
            <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#E7ECE7] pb-3">
                <h2 className="text-sm font-semibold text-[#202923]">Conversation Intelligence</h2>
                {intelligence && <StatusBadge status={intelligence.qualification_status} />}
              </div>

              {!intelligence ? (
                <p className="py-8 text-center text-xs text-[#78847D]">
                  Start talking or send a message to see real-time intent, sentiment, lead scoring, and CRM extraction.
                </p>
              ) : (
                <div className="mt-4 space-y-4 text-sm">
                  {/* Lead Score Bar */}
                  <div className="rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#78847D]">Lead Score</span>
                      <span className="text-lg font-bold text-[#16865A]">{intelligence.lead_score}/100</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E7ECE7]">
                      <div
                        className="h-full rounded-full bg-[#16865A] transition-all"
                        style={{ width: `${Math.min(100, intelligence.lead_score)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#202923]">{intelligence.score_category}</span>
                      <SentimentBadge sentiment={intelligence.sentiment} />
                    </div>
                  </div>

                  {/* Extracted Fields */}
                  <dl className="space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-[#78847D]">
                        <User className="h-3.5 w-3.5" aria-hidden="true" /> Customer
                      </dt>
                      <dd className="text-right font-medium text-[#202923]">
                        {intelligence.customer_name || 'Pending'}
                        {intelligence.company ? ` (${intelligence.company})` : ''}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-[#78847D]">
                        <Target className="h-3.5 w-3.5" aria-hidden="true" /> Buying Intent
                      </dt>
                      <dd className="font-semibold text-[#202923]">{intelligence.buying_intent}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-[#78847D]">
                        <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Budget
                      </dt>
                      <dd className="font-semibold text-[#16865A]">{intelligence.budget || 'Not shared'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-[#78847D]">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Industry / Size
                      </dt>
                      <dd className="text-right font-medium text-[#202923]">
                        {intelligence.business_type || '—'}
                        {intelligence.business_size ? ` • ${intelligence.business_size}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-[#78847D]">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Business Requirement
                      </dt>
                      <dd className="mt-1 rounded-xl bg-[#FAFAF7] p-2.5 text-[#202923]">
                        {intelligence.requirement || 'Gathering requirements...'}
                      </dd>
                    </div>
                  </dl>

                  {/* Appointment Status */}
                  <div
                    className={`rounded-xl border p-3.5 ${
                      intelligence.appointment_details
                        ? 'border-[#BEE6D2] bg-[#DDF2E7]/60'
                        : 'border-[#E7ECE7] bg-[#FAFAF7]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#202923]">
                      <CalendarCheck className="h-4 w-4 text-[#16865A]" aria-hidden="true" />
                      <span>Appointment Status: {intelligence.appointment_status}</span>
                    </div>
                    {intelligence.appointment_details && (
                      <div className="mt-2 space-y-1 text-xs text-[#126E4A]">
                        <p className="font-semibold">{intelligence.appointment_details.appointment_code}</p>
                        <p>
                          {intelligence.appointment_details.scheduled_date} at{' '}
                          {intelligence.appointment_details.scheduled_time} IST
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Transparent Score Breakdown */}
                  {intelligence.score_breakdown && (
                    <details className="rounded-xl border border-[#E7ECE7] p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[#202923]">
                        Score Breakdown (100-pt Rubric)
                      </summary>
                      <ul className="mt-2.5 space-y-2">
                        {intelligence.score_breakdown.criteria.map((c) => (
                          <li key={c.criterion} className="text-xs">
                            <div className="flex justify-between font-medium text-[#202923]">
                              <span>{c.criterion}</span>
                              <span className="text-[#16865A]">
                                {c.points}/{c.max_points}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#78847D]">{c.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Structured Call Summary Card (after End & Summarize) */}
            {summary && (
              <div className="rounded-2xl border border-[#BEE6D2] bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#16865A]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>AI Call Summary (Persisted to CRM)</span>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div>
                    <dt className="inline font-semibold text-[#78847D]">Customer: </dt>
                    <dd className="inline text-[#202923]">
                      {summary.customer_name} ({summary.company})
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#78847D]">Requirement: </dt>
                    <dd className="inline text-[#202923]">{summary.main_requirement}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#78847D]">Budget: </dt>
                    <dd className="inline text-[#202923]">{summary.budget}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#78847D]">Appointment: </dt>
                    <dd className="inline text-[#202923]">{summary.appointment_status}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#78847D]">Next Action: </dt>
                    <dd className="inline font-medium text-[#16865A]">{summary.recommended_next_action}</dd>
                  </div>
                </dl>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};
