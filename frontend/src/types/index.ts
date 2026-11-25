export type NavPage =
  | 'overview'
  | 'voice-agent'
  | 'leads'
  | 'appointments'
  | 'knowledge'
  | 'analytics'
  | 'settings';

export type OllamaConnectionState = 'connected' | 'connecting' | 'model_missing' | 'disconnected';

export interface HealthStatus {
  backend_status: string;
  ollama_status: 'connected' | 'model_missing' | 'disconnected';
  ollama_base_url: string;
  model_name: string;
  model_available: boolean;
  embedding_model: string;
  embedding_model_status: string;
  database_status: string;
  knowledge_chunks: number;
  error_detail?: string | null;
  install_instructions?: string | null;
}

export interface RAGSource {
  filename: string;
  score: number;
  snippet: string;
}

export interface ScoreCriterion {
  criterion: string;
  points: number;
  max_points: number;
  reason: string;
}

export interface ScoreBreakdown {
  total_score: number;
  category: string;
  qualified: boolean;
  criteria: ScoreCriterion[];
}

export interface ConversationIntelligence {
  lead_id?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  company?: string | null;
  business_type?: string | null;
  requirement?: string | null;
  pain_points: string[];
  budget?: string | null;
  business_size?: string | null;
  timeline?: string | null;
  buying_intent: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | string;
  sentiment_reason?: string | null;
  lead_score: number;
  score_category: string;
  score_breakdown?: ScoreBreakdown | null;
  qualification_status: string;
  services_discussed: string[];
  objections: string[];
  appointment_status: string;
  appointment_details?: {
    id: number;
    appointment_code: string;
    scheduled_date: string;
    scheduled_time: string;
    timezone: string;
    status: string;
    customer_name: string;
  } | null;
  available_slots_offered: string[];
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  language: 'en' | 'hi' | string;
  sources: RAGSource[];
  intelligence: ConversationIntelligence;
  latency_ms: number;
  ollama_used: boolean;
  error?: string | null;
}

export interface ChatTurn {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  language: string;
  sentiment?: string | null;
  sources?: RAGSource[];
  timestamp: string;
}

export interface CallSummary {
  customer_name: string;
  company: string;
  business_type: string;
  main_requirement: string;
  pain_points: string[];
  budget: string;
  sentiment: string;
  buying_intent: string;
  services_discussed: string[];
  objections: string[];
  lead_score: number;
  qualification_status: string;
  recommended_next_action: string;
  appointment_status: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Unqualified' | 'Converted';

export interface Lead {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  business_type?: string | null;
  requirement?: string | null;
  pain_points?: string | null;
  budget?: string | null;
  budget_numeric?: number | null;
  business_size?: string | null;
  timeline?: string | null;
  buying_intent: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  lead_score: number;
  score_category: string;
  score_breakdown?: ScoreBreakdown | null;
  status: LeadStatus;
  source: string;
  services_interested: string[];
  objections: string[];
  summary?: CallSummary | null;
  conversation_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: number;
  appointment_code: string;
  lead_id?: number | null;
  conversation_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  company?: string | null;
  service_topic: string;
  resource_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  timezone: string;
  status: 'Confirmed' | 'Completed' | 'Cancelled';
  confirmed_by_customer: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableSlot {
  date: string;
  time: string;
  timezone: string;
  label: string;
}

export interface KnowledgeDocument {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  chunk_count: number;
  character_count: number;
  is_sample: boolean;
  indexed: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverview {
  total_leads: number;
  qualified_leads: number;
  appointments_booked: number;
  conversion_rate: number;
  average_lead_score: number;
  total_conversations: number;
  knowledge_documents: number;
  popular_services: { name: string; count: number }[];
  common_objections: { name: string; count: number }[];
  recent_activity: {
    type: 'lead' | 'appointment';
    title: string;
    subtitle: string;
    timestamp: string;
  }[];
}

export interface LeadsAnalytics {
  leads_over_time: { date: string; total: number; qualified: number }[];
  by_status: { status: string; count: number }[];
  by_potential: { category: string; count: number }[];
}

export interface SentimentAnalytics {
  distribution: { sentiment: string; count: number }[];
}

export interface AppointmentsAnalytics {
  trends: { date: string; confirmed: number; cancelled: number; completed: number }[];
  by_status: { status: string; count: number }[];
}

export interface WorkspaceSettings {
  default_language: 'en' | 'hi';
  voice_rate: number;
  voice_name: string;
  tts_enabled: boolean;
  business_name: string;
  business_hours: string;
  appointment_duration: number;
  qualification_threshold: number;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
