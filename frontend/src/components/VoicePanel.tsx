import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Play, Square, RotateCcw, Info } from 'lucide-react';

interface VoicePanelProps {
  sessionActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  sttSupported: boolean;
  ttsSupported: boolean;
  ttsEnabled: boolean;
  language: 'en' | 'hi';
  interimTranscript: string;
  sttError: string | null;
  onStartSession: () => void;
  onEndSession: () => void;
  onClearSession: () => void;
  onToggleMic: () => void;
  onToggleTts: () => void;
  onStopSpeaking: () => void;
  onLanguageChange: (lang: 'en' | 'hi') => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  sessionActive,
  isListening,
  isSpeaking,
  isLoading,
  sttSupported,
  ttsSupported,
  ttsEnabled,
  language,
  interimTranscript,
  sttError,
  onStartSession,
  onEndSession,
  onClearSession,
  onToggleMic,
  onToggleTts,
  onStopSpeaking,
  onLanguageChange,
}) => {
  return (
    <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!sessionActive ? (
            <button
              type="button"
              onClick={onStartSession}
              className="inline-flex items-center gap-2 rounded-xl bg-[#16865A] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#126E4A]"
            >
              <Play className="h-4 w-4" />
              <span>Start Conversation</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onEndSession}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-sm font-semibold text-[#DC2626] hover:bg-[#FEE2E2] disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              <span>End &amp; Summarize</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClearSession}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7ECE7] bg-white px-3.5 py-2.5 text-sm font-medium text-[#202923] hover:bg-[#F3F6F1]"
          >
            <RotateCcw className="h-4 w-4 text-[#78847D]" />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] p-1" role="group" aria-label="Conversation language">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              aria-pressed={language === 'en'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === 'en' ? 'bg-[#16865A] text-white' : 'text-[#78847D] hover:text-[#202923]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('hi')}
              aria-pressed={language === 'hi'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === 'hi' ? 'bg-[#16865A] text-white' : 'text-[#78847D] hover:text-[#202923]'
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>

          <button
            type="button"
            onClick={isSpeaking ? onStopSpeaking : onToggleTts}
            disabled={!ttsSupported}
            aria-pressed={ttsEnabled}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
              ttsEnabled
                ? 'border-[#BEE6D2] bg-[#DDF2E7] text-[#16865A]'
                : 'border-[#E7ECE7] bg-white text-[#78847D]'
            }`}
          >
            {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{isSpeaking ? 'Stop Audio' : ttsEnabled ? 'TTS On' : 'TTS Off'}</span>
          </button>
        </div>
      </div>

      {/* Center Microphone Control */}
      <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-[#E7ECE7] bg-[#FAFAF7] px-4 py-6 text-center">
        <button
          type="button"
          onClick={onToggleMic}
          disabled={!sttSupported || isLoading}
          aria-pressed={isListening}
          aria-label={isListening ? 'Stop voice recording' : 'Start voice recording'}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-all focus-visible:outline-[#16865A] disabled:cursor-not-allowed disabled:opacity-50 ${
            isListening
              ? 'bg-[#DC2626] text-white ring-8 ring-[#FEE2E2]'
              : 'bg-[#16865A] text-white hover:bg-[#126E4A] ring-4 ring-[#DDF2E7]'
          }`}
        >
          {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>

        <p className="mt-3 text-sm font-semibold text-[#202923]">
          {isListening
            ? language === 'hi'
              ? 'सुन रहा हूँ... बोलिए (रोकने के लिए क्लिक करें)'
              : 'Listening... Speak naturally (click to stop)'
            : isLoading
            ? 'VoxLead AI is thinking with local Qwen 2.5 3B...'
            : sttSupported
            ? language === 'hi'
              ? 'बात करने के लिए माइक दबाएँ या नीचे टाइप करें'
              : 'Tap microphone to speak or type below'
            : 'Voice input unavailable in this browser — use text input below'}
        </p>

        {interimTranscript && (
          <div className="mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-xl border border-[#BEE6D2] bg-white px-4 py-2 text-sm text-[#202923]">
            <div>
              <span className="font-semibold text-[#16865A]">Live transcript: </span>
              {interimTranscript}
            </div>
            <button
              type="button"
              onClick={onToggleMic}
              className="rounded-lg bg-[#16865A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#126E4A]"
            >
              Send Now
            </button>
          </div>
        )}

        {sttError && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-[#D97706]">
            {sttError}
          </p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#78847D]">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Voice STT uses browser SpeechRecognition (may depend on browser network services); all AI reasoning, RAG, and CRM run locally.
          </span>
        </p>
      </div>
    </div>
  );
};
