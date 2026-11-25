import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useSpeech(language: 'en' | 'hi', ttsEnabled: boolean, voiceRate = 1.0) {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;

  const sttSupported = Boolean(SpeechRecognitionCtor);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const submittedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const callbackRef = useRef<((text: string) => void) | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const flushTranscript = useCallback(() => {
    clearSilenceTimer();
    if (submittedRef.current) return;
    const text = latestTranscriptRef.current.trim();
    if (text && callbackRef.current) {
      submittedRef.current = true;
      latestTranscriptRef.current = '';
      setInterimTranscript('');
      callbackRef.current(text);
    } else {
      setInterimTranscript('');
    }
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop error
    }
    setIsListening(false);
    // Safari may not emit isFinal before/during stop(); flush any captured transcript
    flushTranscript();
  }, [clearSilenceTimer, flushTranscript]);

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [ttsSupported]);

  const startListening = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      if (!SpeechRecognitionCtor) {
        setSttError('Browser SpeechRecognition is unavailable in this browser. Please use the text input below.');
        return;
      }

      stopSpeaking();
      clearSilenceTimer();
      setSttError(null);
      setInterimTranscript('');
      latestTranscriptRef.current = '';
      submittedRef.current = false;
      callbackRef.current = onFinalTranscript;

      const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = true;
      // continuous=true prevents premature Safari abort while still letting our silence timer + stop button submit cleanly
      recognition.continuous = true;

      let committedFinal = '';

      recognition.onresult = (event: any) => {
        let fullFinal = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const chunk = (result[0]?.transcript || '').trim();
          if (!chunk) continue;
          if (result.isFinal) {
            fullFinal += `${chunk} `;
          } else {
            currentInterim += `${chunk} `;
          }
        }

        if (fullFinal.trim()) {
          committedFinal = fullFinal.trim();
        }
        const combined = [committedFinal || fullFinal.trim(), currentInterim.trim()]
          .filter(Boolean)
          .join(' ')
          .trim();

        latestTranscriptRef.current = combined;
        setInterimTranscript(combined);

        // If user pauses for 1.6s after speaking, auto-stop and send to chatbot
        clearSilenceTimer();
        if (combined) {
          silenceTimerRef.current = window.setTimeout(() => {
            try {
              recognition.stop();
            } catch {
              // Ignore
            }
            setIsListening(false);
            flushTranscript();
          }, 1600);
        }
      };

      recognition.onerror = (event: any) => {
        clearSilenceTimer();
        const err = event?.error || 'speech_error';
        if (err === 'not-allowed') {
          setSttError('Microphone permission denied. Allow mic access or use text input.');
        } else if (err === 'network') {
          setSttError('Browser speech recognition service requires internet connectivity; use text input fallback if offline.');
        } else if (err !== 'no-speech' && err !== 'aborted') {
          setSttError(`Speech recognition error (${err}). You can type your message anytime.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setIsListening(false);
        flushTranscript();
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setIsListening(true);
      } catch (err: any) {
        setSttError(err?.message || 'Unable to start microphone.');
        setIsListening(false);
      }
    },
    [SpeechRecognitionCtor, clearSilenceTimer, flushTranscript, language, stopSpeaking]
  );

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || !ttsSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = voiceRate;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) =>
        language === 'hi' ? v.lang.toLowerCase().startsWith('hi') : v.lang.toLowerCase().startsWith('en')
      );
      if (preferred) {
        utterance.voice = preferred;
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [language, ttsEnabled, ttsSupported, voiceRate]
  );

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      stopSpeaking();
    };
  }, [clearSilenceTimer, stopSpeaking]);

  return {
    sttSupported,
    ttsSupported,
    isListening,
    isSpeaking,
    interimTranscript,
    sttError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
